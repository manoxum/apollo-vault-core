// filename: src/libs/apollo-vault/services/OrchestrationRoot.ts

import {
    OrchestrationLinkedNode, OrchestrationLinkedResolverRoot,
    OrchestrationNode,
    OrchestrationTree,
    OrchestrationTreeRoot
} from "../types";

export async function ResolveOrchestrationRoot<I,T, R>(
    resolver: OrchestrationLinkedResolverRoot<I,T, R>,
    args:unknown,
    id?:string,
    level?:number,
    ...path:(string|number)[]
): Promise<OrchestrationTreeRoot<I,T,R> | undefined>{


    if( !resolver ) return undefined
    let options:OrchestrationTree<I,T, R>;
    if( typeof resolver === "function" ) options = (await (resolver as CallableFunction)(args));
    else options = await resolver;
    if( !options ) return undefined;

    level = level ?? 0;
    if( !id && level === 0 ) id = (options as OrchestrationTreeRoot<I,T,R>).registry
    if( !id ) throw new Error( "NEED id for registration" );
    const key = path.join("/");

    const keys = Object.keys(options?.linked ?? {});
    if( !keys.length ) return {
        key,
        registry: id,
        ...options,
        linked: undefined
    }

    const promise = Object.entries( options.linked??{} )
        .map( async ([key, l]) => {
            let node:OrchestrationTreeRoot<I,T,R >;
            if( typeof l === "function" ) {
                node = await l( args );
            } else node = await l as OrchestrationTreeRoot<I, T, R>;

            let nodes:  OrchestrationNode<I,T, unknown> | OrchestrationNode<I,T, unknown>[] | null;
            if( Array.isArray(node)){
                nodes = [];
                for (let i = 0; i < node.length; i++) {
                    const value = node[i];
                    const resolved = await ResolveOrchestrationRoot( value, args, id, level+1, ...path, key, i);
                    if( !resolved ) continue;
                    nodes.push( resolved as  typeof nodes[number]);
                }
                if( !nodes.length ) nodes = null;
            } else {
                nodes = await ResolveOrchestrationRoot( node, args, id, level+1, ...path, key ) as typeof nodes;
            }
            return [ key, nodes ] as const;
        });

    const linkedEntries = (await Promise.all( promise ))
        .filter( ( [,v] ) => !!v )
    ;
    return {
        key,
        registry: id,
        ...options,
        linked: Object.fromEntries(linkedEntries) as (T&OrchestrationLinkedNode<I, T, R>)
    }

}

