// filename: src/libs/apollo-vault/hook/useIncrementalQuery.ts

import {useQuery} from "@apollo/client/react";
import {useEffect, useMemo, useState} from "react";
import {DocumentNode, OperationVariables, TypedDocumentNode} from "@apollo/client";
import {IncrementalResponse} from "../types";


export function useIncrementalQuery<O>(
    document: DocumentNode | TypedDocumentNode<O, Record<string, unknown>>,
    options?: useQuery.Options<O, Record<string, unknown>>
):IncrementalResponse<O, Record<string, unknown>>;

export function useIncrementalQuery<O,V extends { [ k in keyof V ]:V[k]}>(
    document: DocumentNode | TypedDocumentNode<O, V>,
    options?: useQuery.Options<O, V>
):IncrementalResponse<O, V>;

export function useIncrementalQuery<O,V extends OperationVariables >(
    document: DocumentNode | TypedDocumentNode<O, V>,
    options?: useQuery.Options<O, V>
){
    const [ incremental, setIncremental ] = useState( undefined as O );
    const [ loadingFirst, setLoadingFirst ] = useState( true );
    const [ chunk, setChunk ] = useState( 0 );

    const stream = useQuery<O, V>( document, {
        ...(options??{} as useQuery.Options<O, V>)
    });

    useEffect(() => {
        if (!stream.observable) return;
        const subscription = stream.observable.subscribe({
            next(result) {
                if( !!result.data ){
                    if( loadingFirst ) setLoadingFirst( false );
                    setChunk( prevState => prevState +1 );
                }
                setIncremental( () => {
                    return (stream.loading ? result.data : stream.data) as O
                })
            },
            complete() {
                setIncremental( () => {
                    return (stream.data) as O
                })
            }
        });
        return () => subscription.unsubscribe();
    }, [loadingFirst, stream.data, stream.loading, stream.observable]);

    return useMemo(()=>{
        return {
            ...stream,
            chunk,
            loadingFirst,
            incremental
        }
    }, [incremental, stream, chunk, loadingFirst]);
}
