// filename: src/libs/apollo-vault/link/response.ts


import {ApolloVaultService} from "../types";
import {ApolloLink, Observable} from "@apollo/client";

export function CreateMonitoringLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink( ( operation, forward) => {
        return new Observable( observer => {
            const subscription = forward( operation ).subscribe( {
                next( response ) {
                    instance.publishResponse({ operation, response });
                    observer.next( response );
                },
                error( error ){
                    console.error( `Error ao executar::error ${operation.operationName}`, error, error.message, error.code);
                    instance.publishResponse({ operation, response: { errors: error } });
                    observer.error( error );
                },
                complete(){
                    observer.complete()
                }
            });

            // 5. Limpeza (cleanup): Desinscreve a assinatura quando o link é removido
            return () => {
                subscription.unsubscribe();
            }
        });
    });
}