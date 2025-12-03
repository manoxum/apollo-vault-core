// filename: src/libs/apollo-vault/link/orchestration.ts


import {ApolloLink, Observable} from "@apollo/client";
import {ApolloVaultService, OrchestrationNodeResponse} from "../types";
import {ObjMap} from "graphql/jsutils/ObjMap";
import {APOLLO_VAULT_SIMBOLS} from "../utils/symbols";


export function CreateOrchestrationLink<ID extends Record<string, unknown>, AUTH extends Record<string, unknown>>(
    service: ApolloVaultService<ID, AUTH>
) {

    return new ApolloLink((operation, forward) => {
        return new Observable((observer) => {
            (async () => {
                const context = operation.getContext();
                const { OrchestrationNode } = context;
                if (!OrchestrationNode || OrchestrationNode?.BYPASS )
                    return forward(operation).subscribe(observer);

                try {
                    // Executa a operação raiz
                    OrchestrationNode.name = operation.operationName;
                    const tree = await service.executeOrchestration( OrchestrationNode );
                    const extensions = tree.extensions??{};


                    if( tree.ExistsEventualDeliveryTask ){
                        const saved = await service.createEventualFormOrchestration( tree );
                        extensions.EventualDeliveryResponse = {
                            ...saved.entry,
                        };
                    }

                    extensions.OrchestrationResponse = {
                        tree: tree,
                            parsed: parse( tree, {} )
                    };

                    observer.next({
                        data: tree.data as ObjMap<unknown> | null | undefined ,
                        extensions: {
                            ...extensions,
                        },
                    });
                    observer.complete();
                } catch (err) {
                    observer.error(err);
                }
            })();
        });
    });
}



export type ParseOptions = {
    s?: string[];
};


export function parse( node: OrchestrationNodeResponse, options: ParseOptions, parent?:Record<string|symbol, unknown>, root?:Record<string|symbol, unknown>): Record<string|symbol, unknown> {
    if( node.errors ){
        const error = new Error("Operation failed" );
        error.cause = node.errors;
        return error as unknown as Record<string, unknown>;
    }
    const response = node.data??{};
    const keys = Object.keys(response);
    const linked = Object.entries( node.linked??{} );
    const field = keys[0];
    const value = response[field as keyof typeof response] as unknown;
    // if( !linked.length ) return value as Record<string, unknown>;

    const parsed:Record<string|symbol, unknown> = {};
    if( !root ) root = parsed;
    linked.forEach( ([field, child]) => {
        if( Array.isArray( child ) ) {
            const parsedList:unknown[] = [];
            child.forEach( next => parsedList.push( parse( next, options ) ) );
            parsed[field] = parsedList;
        } else parsed[field] = parse( child, options, parsed, root );
    });

    parsed[APOLLO_VAULT_SIMBOLS.$] = value;
    parsed[APOLLO_VAULT_SIMBOLS.DATA] = node.data;
    parsed[APOLLO_VAULT_SIMBOLS.EXTENSION] = node.extensions;
    parsed[APOLLO_VAULT_SIMBOLS.ERROR] = node.errors;
    parsed[APOLLO_VAULT_SIMBOLS.ROOT] = root;
    parsed[APOLLO_VAULT_SIMBOLS.PARENT] = parent;
    return parsed;
}