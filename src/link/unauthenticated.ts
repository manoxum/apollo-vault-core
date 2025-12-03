// filename: src/libs/apollo-vault/link/unauthenticated.ts

import {ApolloLink, ErrorLike, Observable} from "@apollo/client";
import {FormattedExecutionResult} from "graphql/execution";
import {ApolloVaultService} from "../types";
import {GraphQLFormattedError} from "graphql/error";
import {GraphQLError} from "graphql/index";
import {isMutationOperation, isQueryOperation} from "../utils/operation";


// ====================================================================
// 🔹 Função Auxiliar: isUnauthenticatedError (Permanece igual)
// ====================================================================
function isUnauthenticatedError(errors: unknown, code?:string): boolean {
    if (!errors) return false;
    // ... (corpo da função isUnauthenticatedError permanece o mesmo)
    const errorList: GraphQLFormattedError[] = [];

    if (Array.isArray(errors)) {
        errorList.push(...(errors as (GraphQLFormattedError | GraphQLError)[]).map(e => e as GraphQLFormattedError));
    }
    else {
        type ErrorContainerWithGraphQLErrors = {
            graphQLErrors?: readonly (GraphQLFormattedError | GraphQLError)[]
            error?: { graphQLErrors?: readonly (GraphQLFormattedError | GraphQLError)[] }
        };

        const errorContainer = errors as unknown as ErrorContainerWithGraphQLErrors;

        let sourceErrors: readonly (GraphQLFormattedError | GraphQLError)[] | undefined;

        if (errorContainer.graphQLErrors) {
            sourceErrors = errorContainer.graphQLErrors;
        }
        else if (errorContainer.error?.graphQLErrors) {
            sourceErrors = errorContainer.error.graphQLErrors;
        }
        else {
            errorList.push(errors as unknown as GraphQLFormattedError);
        }

        if (sourceErrors) {
            errorList.push(...sourceErrors.map(e => e as GraphQLFormattedError));
        }
    }

    return errorList.some(value => {
        return value?.extensions?.["code"] === (code??"UNAUTHENTICATED");
    });
}


// ====================================================================
// 🔗 ApolloLink: CreateUnauthorizedErrorLink
// ====================================================================
export function CreateUnauthenticatedLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink( ( operation, forward) => {
        return new Observable(observer => {

            const externalClean: CallableFunction[] = [];
            // 💡 CORREÇÃO: Variável elevada para o escopo do Observable
            let currentSubscription: { unsubscribe: () => void } | null = null;

            (async ()=>{
                const context = operation.getContext();
                const isMutation = isMutationOperation(operation.query);
                const isQuery = isQueryOperation(operation.query);

                // 1. BYPASS check
                const BYPASS = context.WaitAuthentication?.BYPASS
                    || !(context.WaitAuthentication ?? instance.status.WaitAuthentication)
                    || !(isQuery || isMutation)
                    || !(await instance.status.isHealthy())

                if(BYPASS){
                    const sub = forward(operation).subscribe(observer);
                    externalClean.push( sub.unsubscribe );
                    return;
                }

                // Obtém configurações de WaitAuthentication
                const timeout = context.WaitAuthentication?.timeout ?? instance.status.WaitAuthentication?.timeout ?? (15 * 1000);
                const maxAttempts = context.WaitAuthentication?.attempts ?? instance.status.WaitAuthentication?.attempts ?? 3;
                let attemptsCount = context.WaitAuthentication?.attemptsCount ?? 1;
                let isUnauthenticatedPublished = false;
                let detectedUnauthenticated = false;

                const subscribe = () => {
                    // Limpa a subscrição anterior antes de iniciar uma nova
                    currentSubscription?.unsubscribe?.();

                    currentSubscription = forward(operation).subscribe({
                        next(res) {
                            if (res.errors && isUnauthenticatedError(res.errors, context.UseUnauthenticatedCode??instance.status.UseUnauthenticatedCode)) {
                                detectedUnauthenticated = true;
                                externalClean.push(handleUnauthenticated(res));
                            } else {
                                if (detectedUnauthenticated) {
                                    instance.status.authenticated = true;
                                }
                                observer.next(res);
                                observer.complete();
                                currentSubscription = null;
                            }
                        },
                        error(error) {
                            if (isUnauthenticatedError(error, context.UseUnauthenticatedCode?? instance.status.UseUnauthenticatedCode)) {
                                detectedUnauthenticated = true;
                                externalClean.push(handleUnauthenticated( {errors: [error as ErrorLike]} as FormattedExecutionResult));
                            } else {
                                observer.error(error);
                                observer.complete();
                                currentSubscription = null;
                            }
                        },
                        complete() {
                            currentSubscription = null;
                        }
                    });

                    return currentSubscription;
                }

                // 2. Função de lógica de Retry/Espera
                const handleUnauthenticated = (res: FormattedExecutionResult<Record<string, unknown>, Record<string, unknown>> ): ()=> void =>{
                    // 🛑 2.1. LIMITE DE TENTATIVAS (CHECK)
                    if (attemptsCount >= maxAttempts) {
                        if(res) observer.next(res);
                        observer.error(new Error(`Unauthorized: Maximum retry attempts reached for ${isMutation ? 'mutation' : 'query'}.`));
                        observer.complete();
                        currentSubscription = null;
                        return () => {};
                    }

                    attemptsCount++;
                    const internalClean: (() => void)[] = [];

                    // Subscrição à autenticação recebida
                    const unsub = instance.subscribe("authenticated", () => {
                        internalClean.forEach(fn => fn());
                        subscribe()
                    });
                    internalClean.push(unsub);

                    // Timeout de espera
                    const out = setTimeout( () => {
                        internalClean.forEach(fn => fn());
                        subscribe();
                    }, timeout);
                    internalClean.push(() => clearTimeout(out));


                    if( !isUnauthenticatedPublished ){
                        isUnauthenticatedPublished = true;
                        instance.status.authenticated = false;
                        instance.requestAuthentication()
                    }

                    // A função de limpeza só limpa o timeout e a sub da instância
                    return () => {
                        internalClean.forEach(fn => fn());
                    };
                }

                // 4. Retorna a subscrição inicial
                subscribe();

            })();

            // 5. Funções de limpeza do Observable do Link (Cleanup)
            return () => {
                currentSubscription?.unsubscribe();
                externalClean.forEach( fn => fn() );
            }
        })

    });
}