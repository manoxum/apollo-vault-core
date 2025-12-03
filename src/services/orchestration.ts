// filename: src/libs/apollo-vault/services/orchestration.ts


import {
    ApolloVaultService, OrchestrationEventDefinitions,
    OrchestrationNode,
    OrchestrationNodeResponse,
    OrchestrationTreeRoot
} from "../types";
import {noCicle} from "../utils/no-cicle";
import {isMutationOperation} from "../utils/operation";
import {DefaultContext} from "@apollo/client";
import {ExecutionResult} from "graphql/execution";
import {GraphQLError} from "graphql/index";
import {CreateSubscriptionChannels} from "../utils/subscription";

export async function ExecuteOrchestrationFromResponseService<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>(
    service: ApolloVaultService<ID, AUTH>,
    result: OrchestrationNodeResponse
): Promise<OrchestrationNodeResponse> {
    const node = await service.getOrchestrationRootRegistry( result.registry, result?.status?.arguments );

    if( !node ) return result;
    return ExecuteOrchestrationService( service, node, result.status?.arguments, result, result );
}

export async function ExecuteOrchestrationService<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>(
    instance: ApolloVaultService<ID, AUTH>,
    tree: OrchestrationNode<Record<string, unknown>, Record<string, unknown>, unknown>
        |  OrchestrationTreeRoot<Record<string, unknown>, Record<string, unknown>, unknown>,
    args?:Record<string, unknown>,
    current?: OrchestrationNodeResponse,
    root?: OrchestrationNodeResponse,
    parent?: OrchestrationNodeResponse,
    recursion?: number
): Promise<OrchestrationNodeResponse> {
    const node = tree as OrchestrationNode<Record<string, unknown>, Record<string, unknown>, unknown>;

    if( !current ) current = { registry: node.registry };
    if( !root ) root = current;
    current.status = {}
    current.parent = parent;
    current.node = node;
    if( !recursion ) recursion = 0;
    if (!args ) args = node.arguments;

    if( !root.status ) root.status = {};
    root.status.recursion = (root.status?.recursion??0)+1;

    type RK = Record<string, unknown>;
    if( typeof node.subscription === "function" && !node.SubscriptionChannels ){
        const channels = CreateSubscriptionChannels<OrchestrationEventDefinitions<RK,RK,unknown>>();
        node.SubscriptionChannels = channels as typeof node.SubscriptionChannels;
        node.subscription(channels.sub);
    }
    const { pub } = node.SubscriptionChannels??{};



    if( current.status.resolved && !current.ExistsEventualDeliveryTask ){
        current.status.previewResolved = true;
        return current;
    }
    try {
        (()=>{
            if( typeof pub?.publish !== "function" ) return;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            pub.publish( "started", current )
        })();
    }catch(e){ console.error( e)}

    const forward = async (next:OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>, res:OrchestrationNodeResponse )=>{
        return await ExecuteOrchestrationService(
            instance,
            next,
            args,
            res,
            root,
            {...current},
            recursion+1
        )
    }

    if (await node.skip?.(args, parent, root)) {
        current.status.skipped = true;
        return current;
    }

    let vars: Record<string, unknown>|undefined;
    if (typeof node.variables === "function") {
        vars = await node.variables( args, parent, root) as (Record<string, unknown>|undefined);
    } else {
        vars = await node.variables as (Record<string, unknown>|undefined);
    }


    const isMutation = isMutationOperation( node.operation );
    let ctx:DefaultContext|Promise<DefaultContext>;
    if( typeof node.context === "function" ) {
        ctx = await node.context?.();
    } else {
        ctx = await node.context??{};
    }

    current.status.context = await ctx;
    current.status.variables =  vars;
    current.status.arguments =  args;
    const { EventualDelivery, ...context } = current.status.context;

    const execOptions = {
        context: context,
        variables: vars,
    };

    let result: ExecutionResult<unknown>;
    const health = (await instance.status.isHealthy())
        //TODO simular health forcado
        || (root.status?.recursion??0) >= 3
    ;


    if (!health && isMutation && EventualDelivery) {
        // Armazena como eventual se offline
        current.ExistsEventualDeliveryTask = true;
        current.status.resolved = true;
        try {
            (()=>{
                if( typeof pub?.publish !== "function" ) return;
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                pub.publish( "eventual", current )
            })();
        }catch(e){ console.error( e)}
        return current;
    } else {
        current.status.start = Date.now();
        if (isMutation) {
            result = await instance.client!.mutate({
                mutation: node.operation,
                ...execOptions
            });
        } else {
            result = await instance.client!.query({
                query: node.operation,
                ...execOptions,
            });
        }
        current.status.end = Date.now();
        current.status.time = current.status.end -  current.status.start;
    }

    current.data = result.data;
    current.errors = result.errors;
    current.extensions = result.extensions;

    try {
        (()=>{
            if( typeof pub?.publish !== "function" ) return;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            pub.publish("completed", current )
        })();
    }catch(e){ console.error( e)}


    if (result.errors && node.onFailure === "break") {
        if (node.breaker) await node.breaker( result, parent, root);
        throw new GraphQLError("Operation failed");
    }


    const children: Record<string, OrchestrationNodeResponse|OrchestrationNodeResponse[]> = {};
    if (node.linked) {
        const resolveField = async (next: OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>, res: OrchestrationNodeResponse, key:string, container:Record<string, unknown> )=>{
            if( current?.status?.resolved && !current.ExistsEventualDeliveryTask ) {
                container[key] = current;
                return;
            }

            container[key] = await forward( next, res );
            if( !current.linked ) current.linked = {};
            current.linked[ key ] = res;
        }

        const resolveItem = async (next: OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>, res: OrchestrationNodeResponse, key:string, index:number, container:unknown[])=>{
            if( current?.status?.resolved && !current.ExistsEventualDeliveryTask ) {
                container[index] = current;
                return;
            }
            container[index] = await forward( next, res);
            if( !current.linked ) current.linked = {};
            let linked = current.linked[ key ] as OrchestrationNodeResponse[];
            if( !linked ) linked = current.linked[key] = [];
            linked[index] = res;
        }
        const execute = async ( mode:"parallel"|"sequencial" )=>{
            const promises :Promise<void>[] = [];

            for (const [key, child] of Object.entries(node?.linked??{}) ) {
                if( Array.isArray(child) ) {
                    let results:OrchestrationNodeResponse[] = children[key] as OrchestrationNodeResponse[];
                    if( !results ) results = children[key] = [];
                    for (let i = 0; i < child.length; i++) {
                        const next =  child[i];
                        const curLi = (current?.linked?.[key]??[] ) as (OrchestrationNodeResponse[]);
                        const res: OrchestrationNodeResponse = (curLi[i] ?? {}) as  OrchestrationNodeResponse;
                        if( next.parallel && mode === "parallel" ) promises.push( resolveItem( next, res, key, i, results ));
                        else if ( !next.parallel && mode === "sequencial" ) await resolveItem( next, res, key, i, results );
                    }
                } else {
                    const next = child;
                    const res: OrchestrationNodeResponse = (current?.linked?.[key] ?? {}) as  OrchestrationNodeResponse;
                    if( next.parallel && mode === "parallel" ) promises.push( resolveField( next, res, key, children ));
                    else if ( !next.parallel && mode === "sequencial" ) await resolveField( next, res, key, children );
                }
            }
            await Promise.all(promises)
        }

        await Promise.all([
            execute( "parallel" ),
            execute( "sequencial" ),
        ])
    }
    current.ExistsEventualDeliveryTask = !!Object.entries(children).find(([, child]) => {
        if (Array.isArray(child)) return child.find(n => n.ExistsEventualDeliveryTask)
        else return child.ExistsEventualDeliveryTask
    });


    try {
        (()=>{
            if( typeof pub?.publish !== "function" ) return;
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            pub.publish( "finalized", current )
        })();
    }catch(e){ console.error( e)}
    return current
}
