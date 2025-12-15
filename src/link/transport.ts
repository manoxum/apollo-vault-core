// filename: src/libs/apollo-vault/link/transport.ts

import {ApolloLink, HttpLink } from "@apollo/client";
import {CreateFetchTransportLink} from "./fetch";
import {CreateNetworkErrorInterceptorLink} from "./interceptor"; // Importação do novo link
import {ApolloVaultService} from "../types";
import {OperationName} from "../utils/operation";


export function CreateUnifiedTransportLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {

    const createFetchTransportLink = CreateFetchTransportLink( instance );

    // O HttpLink padrão lança networkError para 4xx/5xx/conexão.
    const defaultTransportLink = new HttpLink({
        ...instance.status.transport??{},
        uri( operation){
            if( typeof instance.status.transport?.uri === "function" ) return instance.status.transport?.uri?.( operation ) as string;
            return instance.status.transport?.uri as string;
        }
    });

    const routingLink = new ApolloLink((operation, forward) => {
        const transport = operation.getContext().transport;
        const SwitchTransport = {
            default(){
                return defaultTransportLink.request( operation, forward);
            },
            XCustomFetch (){
                return createFetchTransportLink.request( operation, forward );
            }
        }

        const rd = Math.random() * 10;
        let use:keyof typeof SwitchTransport = "default";
        if (transport === "http/fetch" || rd >= 5) use = "XCustomFetch";

        operation.setContext( prev => ({
            ...prev,
            headers: {
                ...prev.headers??{},
                "Apollo-Require-Preflight": "true",
                "X-Apollo-Vault-Transport": use,
                "X-Apollo-Operation-Name": OperationName( operation )
            }
        }))
        return SwitchTransport[use]();
    });

    const networkErrorInterceptorLink = CreateNetworkErrorInterceptorLink();
    return HttpLink.from([
        networkErrorInterceptorLink,
        routingLink
    ]);
}