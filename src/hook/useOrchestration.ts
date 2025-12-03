import {useState, useCallback, useMemo} from "react";
import { TypedDocumentNode } from "@apollo/client";
import { useApolloVault } from "./useApolloVault";
import { ExecutionResult } from "graphql/execution";
import {
    OrchestrationLinkedResolverRoot,
    OrchestrationNode,
    OrchestrationNodeResponse,
} from "../types";
import {GraphQLError} from "graphql/index";
import {ResolveOrchestrationRoot} from "../services/OrchestrationRoot";


export type ExecutionError<R> = ExecutionResult<R> & {
    error?:Error
}

export type ExecuteCallback<A, R> = ( args: A ) => Promise<ExecutionError<R>>
type UK_I = Record<string, unknown>;
type UK_T = Record<string, unknown>;

export interface UseOrchestrationResult<
    I extends { [k in keyof I]: I[k] },
    R
> {
    execute:ExecuteCallback<I,R>;
    data: R | undefined;
    error: Error | undefined;
    tree?: OrchestrationNodeResponse
    resolved?: unknown
    executing: boolean;
    EventualDelivery: boolean;
}

export function useOrchestration<
    I extends { [k in keyof I]: I[k] },
    T extends { [ k in keyof T]:(T[k]) },
    R,
>(
    registry: `registry://${string}:${string}`,
    resolver: OrchestrationLinkedResolverRoot<I,T,R>
): UseOrchestrationResult<I,R> {

    const [error, setError] = useState<Error|undefined>(undefined);
    const [data, setData] = useState<R | undefined>(undefined);
    const [tree, setTree] = useState<OrchestrationNodeResponse|undefined>(undefined);
    const [resolved, setResolved] = useState<unknown>(undefined);
    const [executing, setExecuting] = useState(false);
    const [EventualDelivery, setEventualDelivery] = useState(false);
    const vault = useApolloVault<Record<string, unknown>, Record<string, unknown>>();

    useMemo(() => {
        vault.registry( registry, resolver);
    }, [registry, resolver, vault]);

    const execute: ExecuteCallback<I, R>= useCallback(async ( args ) => {
        setExecuting(true );
        const root = await ResolveOrchestrationRoot(
            resolver as  OrchestrationLinkedResolverRoot<UK_I, UK_T, unknown>,
            args );
        if( !root ){
            const error = new Error( "Tree definition invalid" );
            setError( error );
            return {
                error,
                errors: [ new GraphQLError(error.message ) ]
            };
        }

        const isMutation = root.operation.definitions.some(
            (def) => def.kind === "OperationDefinition" && def.operation === "mutation"
        );

        try {
            let result: ExecutionResult<R>;
            if (isMutation) {
                result = await vault.client.mutate<R>({
                    mutation: root.operation as TypedDocumentNode<R>,
                    variables: root.variables,
                    context: {
                        ...root.context??{},
                        OrchestrationNode: {
                            ...root,
                            arguments: args
                        } as OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>,
                    },
                });
            } else {
                result = await vault.client.query<R>({
                    query: root.operation as TypedDocumentNode<R>,
                    variables: root.variables,
                    context: {
                        ...root.context??{},
                        OrchestrationNode: {
                            ...root,
                            arguments: args
                        } as OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>,
                    },
                });
            }
            const OrchestrationResponse = result.extensions?.OrchestrationResponse as {
                tree: OrchestrationNodeResponse,
                parsed: unknown
            };

            const error = result.errors?.find( n=>{
                return !!n
            });

            setError( error );
            setData( result.data as R );
            setTree( OrchestrationResponse?.tree );
            setResolved( OrchestrationResponse?.parsed );
            setEventualDelivery( !!result.extensions?.EventualDeliveryResponse );

            return {
                ...result,
                error
            };
        } finally {
            setExecuting(false);
        }
    }, []);


    return {
        execute,
        error,
        data,
        executing,
        EventualDelivery,
        tree,
        resolved
    };
}