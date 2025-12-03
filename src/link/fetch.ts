// filename: src/libs/apollo-vault/link/fetch.ts

import {ApolloLink, Observable} from "@apollo/client";
import {ApolloVaultService} from "../types";
import {print} from "graphql/index";


export function CreateFetchTransportLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink( ( operation) => {
        const context = operation.getContext();
        //Se tiver body e for uma FormData

        return new Observable(observer => {
            const uri =
                (typeof instance.status?.transport?.uri === "function") ? instance.status?.transport?.uri(operation)
                    : !!instance.status?.transport?.uri ? instance.status?.transport?.uri
                        : "/graphql"
            ;
            (async () => {
                const queryText = print(operation.query);
                const content = (()=>{
                    if( context.fetchOptions?.body instanceof FormData ) {
                        return {
                            body: context.fetchOptions?.body,
                            headers: {}
                        }
                    }

                    if( context.fetchOptions?.body === undefined ) return {
                        body: JSON.stringify( {
                            variables: operation.variables,
                            extensions: operation.extensions,
                            operationName: operation.operationName,
                            query: queryText,
                        }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }
                    return {
                        body: context.fetchOptions?.body,
                        headers: {
                            ... !!context.fetchOptions?.["Content-Type"]? { "Content-Type": context.fetchOptions?.["Content-Type"] }: {}
                        }
                    }

                })();

                fetch(uri, {
                    ...(instance.status?.transport?.fetchOptions ?? {}),
                    ...context.fetchOptions,
                    body: content.body,
                    credentials: context.fetchOptions?.credentials ?? instance.status?.transport?.credentials,
                    method: "POST",
                    headers: {
                        ...(instance.status?.transport?.headers ?? {}),
                        ...(context.headers ?? {}),
                        ...(content.headers ?? {}),
                        ...{
                            'x-apollo-operation-name': operation.operationName??""
                        },
                    },
                })
                    .then(async res => {
                        const json = await res.json();
                        if (json.errors) observer.error(json.errors);
                        else observer.next(json);
                        observer.complete();
                    })
                    .catch(err => observer.error(err));
            })()
        });
    });

}