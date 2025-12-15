// filename: src/libs/apollo-vault/services/orchestration.ts


import {
    ApolloVaultService, OrchestrationEventDefinitions,
    OrchestrationNode,
    OrchestrationNodeResponse, OrchestrationTreeRoot
} from "../types";
import {isMutationOperation} from "../utils/operation";
import {DefaultContext, DocumentNode} from "@apollo/client";
import {ExecutionResult} from "graphql/execution";
import {GraphQLError} from "graphql";
import {CreateSubscriptionChannels} from "../utils/subscription";
import {ApolloVaultError} from "../errors/network";




export async function ExecuteOrchestrationEventually<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>(
    service: ApolloVaultService<ID, AUTH>,
    result: OrchestrationNodeResponse
): Promise<OrchestrationNodeResponse> {
    const node = await service.getOrchestrationRootRegistry( result.registry, result?.status?.arguments );

    if( !node ) return result;
    return ExecuteOrchestrationService( service, node, {
        args: result.status?.arguments,
        eventually: true,
        current: result,
        root: result,
        ctx: result.status?.context,
    });
}


type RK = Record<string, unknown>;
type ED = OrchestrationEventDefinitions<Record<string, unknown>, Record<string, unknown>, unknown>;


export type ExecuteOrchestrationServiceOptions = {
    args?:RK,
    eventually?: boolean,
    ctx?:DefaultContext,
    current?: OrchestrationNodeResponse,
    root?: OrchestrationNodeResponse,
    parent?: OrchestrationNodeResponse,
    recursion?: number
}
export async function ExecuteOrchestrationService<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>(
    instance: ApolloVaultService<ID, AUTH>,
    tree: OrchestrationNode<RK, RK, unknown>
        |  OrchestrationTreeRoot<RK, RK, unknown>,
    opts?: ExecuteOrchestrationServiceOptions
): Promise<OrchestrationNodeResponse> {
    const { parent, eventually } = opts??{};
    let { current, ctx, root, recursion, args} = opts??{};
    const node = tree as OrchestrationNode<RK, RK, unknown>;


    if( !current ) current = { registry: node.registry };
    if( !root ) root = current;
    if( !current.status ) current.status = {};

    if( !recursion ) recursion = 0;
    if (!args ) args = node.arguments;
    if( !root.status ) root.status = {};

    current.parent = parent;
    current.node = node;
    const { pub } = node.SubscriptionChannels??{};



    const forward = async (next:OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>, res:OrchestrationNodeResponse )=>{
        return await ExecuteOrchestrationService( instance,  next, {
            ctx,
            args,
            current: res,
            recursion: recursion+1,
            root,
            parent: { ...current },
            eventually
        })
    }
    const publish = <E extends keyof ED>( event:E, ...args: ( ED[E] extends ((...args: infer P) => unknown) ? P : never ))=>{
        try {
            if( typeof pub?.publish !== "function" ) return;
            return pub.publish( event, ...args );
        }catch(e){ console.error( e)}
    }
    const resolver = async () =>{
        publish( "started:resolve", node );
        if( typeof node.context === "function" ) {
            ctx = (await node.context( args as Record<string, unknown>, parent, root ))??{};
            current.status!.context = ctx??{};
        } else if( !!node.context) {
            ctx = await node.context??{};
            current.status!.context = ctx??{};
        } else {
            ctx = ctx ?? {};
            current.status!.context = ctx;
        }

        if( await (async ()=>{
            if( typeof node.skip !== "function" ) return false;
            return node.skip( args, parent, root);
        })()) return  current;


        let vars: Record<string, unknown>|undefined;
        if (typeof node.variables === "function") {
            vars = await node.variables( args as Record<string, unknown>, parent, root) as (Record<string, unknown>|undefined);
        } else {
            vars = await node.variables as (Record<string, unknown>|undefined);
        }


        let opr: DocumentNode;
        if (typeof node.operation === "function") {
            opr = await node.operation( args as Record<string, unknown>, parent, root);
        } else {
            opr = await node.operation ;
        }

        const isMutation = isMutationOperation( opr );


        current.status!.variables =  vars;
        current.status!.arguments =  args;
        const { EventualDelivery, ...context } = current.status!.context;

        const execOptions = {
            context: context,
            variables: vars,
        };

        const SendEventually = ()=>{
            current.ExistsEventualDeliveryTask = true;
            publish( "eventual", node );
            return false;
        }

        let ExecResult: ExecutionResult<unknown> = {};
        const health = (await instance.status.isHealthy());
        if (!health && isMutation && EventualDelivery)  return SendEventually();

        current.ExistsEventualDeliveryTask = false;
        current.status!.start = Date.now();

        try {
            if (isMutation) {
                ExecResult = await instance.client!.mutate({
                    mutation: opr,
                    ...execOptions
                });
            } else {
                ExecResult = await instance.client!.query({
                    query: opr,
                    ...execOptions,
                });
            }
            console.log( "ExecResult.success::e", ExecResult );
        } catch (e) {
            const asEventually = !!EventualDelivery
                && (e instanceof ApolloVaultError)
                && (
                    e.statusCode === "CONNECTION_FAILED"
                    || e.statusCode === "NETWORK_ERROR_DEFAULT"
                    || e.statusCode === "UNKNOWN_NETWORK_ERROR"
                )
            ;

            if( asEventually ) return SendEventually();
            else throw e;
        }


        current.status!.end = Date.now();
        current.status!.time = current.status!.end -  current.status!.start;
        current.data = ExecResult.data;
        current.errors = ExecResult.errors;
        current.extensions = ExecResult.extensions;
        current.status!.resolved = true;

        if (ExecResult.errors && node.onFailure === "break") {
            if (node.breaker) await node.breaker( ExecResult, parent, root);
            throw new GraphQLError("Operation failed");
        }
        publish("resolved", current );
        return true;
    }
    const complete = async ()=>{
        publish( "started:completion", node, current )
        const children: Record<string, OrchestrationNodeResponse|OrchestrationNodeResponse[]> = {};
        if (node.linked) {
            const resolveField = async (next: OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>, res: OrchestrationNodeResponse, key:string, container:Record<string, unknown> )=>{
                // if( current?.status?.complete && !current.ExistsEventualDeliveryTask ) {
                //     container[key] = current;
                //     return;
                // }

                container[key] = await forward( next, res );
                if( !current.linked ) current.linked = {};
                current.linked[ key ] = res;
            }
            const resolveItem = async (next: OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>, res: OrchestrationNodeResponse, key:string, index:number, container:unknown[])=>{
                // if( current?.status?.resolved && !current.ExistsEventualDeliveryTask ) {
                //     container[index] = current;
                //     return;
                // }
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
        current.status!.complete = !current.ExistsEventualDeliveryTask;
        publish( "completed", current )
    }

    if( typeof node.subscription === "function" && !node.SubscriptionChannels ){
        const channels = CreateSubscriptionChannels<OrchestrationEventDefinitions<RK,RK,unknown>>();
        node.SubscriptionChannels = channels;
        node.subscription( channels.sub );
    }


    if( eventually && typeof node.eventualize === "function" ){
        const isValid = await node.eventualize( args as Record<string, unknown>, current, parent, root );
        if( isValid === "rejected" ) {
            current.ExistsEventualDeliveryTask = false;
            current.errors = [ new GraphQLError("Eventually rejected!")];
            return  current;
        }
    }

    if( eventually ) publish("eventualized", args as Record<string, unknown>, current, parent, root );
    publish( "begin", node );
    //Resolver o NO atual
    if( !current.status.resolved ) await resolver();
    if( current.status.resolved && !current.status.complete ) await complete();
    publish( "end", current, node );
    return current;
}
