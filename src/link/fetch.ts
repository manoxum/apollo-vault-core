import {ApolloLink, Observable} from "@apollo/client";
import {ApolloVaultService} from "../types";
import {print} from "graphql/index";
import {ApolloVaultError} from "../errors/network";


export function CreateFetchTransportLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink( ( operation) => {
        const context = operation.getContext();

        return new Observable(observer => {
            // ... (Lógica de URI e Content permanece inalterada) ...
            const uri =
                (typeof instance.status?.transport?.uri === "function") ? instance.status?.transport?.uri(operation)
                    : !!instance.status?.transport?.uri ? instance.status?.transport?.uri
                        : "/graphql"
            ;
            (async () => {
                const queryText = print(operation.query);
                const content = (()=>{
                    if( context.fetchOptions?.body instanceof FormData ) {
                        return { body: context.fetchOptions?.body, headers: {} }
                    }
                    if( context.fetchOptions?.body === undefined ) return {
                        body: JSON.stringify( {
                            variables: operation.variables,
                            extensions: operation.extensions,
                            operationName: operation.operationName,
                            query: queryText,
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    }
                    return {
                        body: context.fetchOptions?.body,
                        headers: {
                            ... !!context.fetchOptions?.["Content-Type"]? { "Content-Type": context.fetchOptions?.["Content-Type"] }: {}
                        }
                    }
                })();

                fetch( uri, {
                    // ... (configurações de fetch permanecem inalteradas) ...
                    ...(instance.status?.transport?.fetchOptions ?? {}),
                    ...context.fetchOptions,
                    body: content.body,
                    credentials: context.fetchOptions?.credentials ?? instance.status?.transport?.credentials ?? 'same-origin',
                    method: "POST",
                    headers: {
                        ...(instance.status?.transport?.headers ?? {}),
                        ...(context.headers ?? {}),
                        ...(content.headers ?? {}),
                    },
                }).then( async res => {
                    const statusCode = res.status;

                    // 1. Tratamento de Erro HTTP (4xx, 5xx): Lança um erro para o interceptor pegar
                    if (statusCode >= 400 || !res.ok) {
                        const errorBody = await res.text();

                        // Cria um erro de rede com o status para o interceptor ler
                        const httpError = new ApolloVaultError(`Response not successful: Status code ${statusCode}`, statusCode) as Error & { statusCode: number, response: Response, body: string };
                        httpError.statusCode = statusCode;
                        httpError.response = res;
                        // Opcional, mas útil
                        httpError.body = errorBody;

                        // Lança o erro de volta para ser pego pelo CreateNetworkErrorInterceptorLink
                        observer.error(httpError);
                        return;
                    }
                    // 2. Resposta bem-sucedida (2xx)
                    const json = await res.json();

                    // Envia a resposta limpa, sem a extensão UnifiedTransport
                    observer.next(json);
                    observer.complete();
                }).catch( err => {
                    // 3. Tratamento de Erro de Conexão Pura: Lança o erro para o interceptor pegar
                    // (Inclui TypeError: Failed to fetch)
                    observer.error(err);
                });
            })()
        });
    });
}