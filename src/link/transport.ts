// filename: src/libs/apollo-vault/link/transport.ts

import {ApolloLink, HttpLink} from "@apollo/client";
import {CreateFetchTransportLink} from "./fetch";
import {ApolloVaultService} from "../types";


export function CreateUnifiedTransportLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    const createFetchTransportLink = CreateFetchTransportLink( instance );
    const defaultTransportLink = new HttpLink({
        ...instance.status.transport??{},
        uri( operation){
            if( typeof instance.status.transport?.uri === "function" ) return instance.status.transport?.uri?.( operation ) as string;
            return instance.status.transport?.uri as string;
        }
    });


    return new ApolloLink((operation, forward) => {
        const transport = operation.getContext().transport;
        if (transport === "http/fetch") return createFetchTransportLink.request(operation, forward);
        return defaultTransportLink.request(operation, forward);
    });
}