// filename: src/provider.tsx

import {createContext} from "react";
import {
    ApolloOfflineVaultOptions,
     ApolloOfflineVault
} from "./types";
import {ApolloProvider} from "@apollo/client/react";

export const ApolloVaultContext = createContext<ApolloOfflineVault<Record<string, unknown>,Record<string, unknown>|undefined>|undefined>(undefined);

export function ApolloVaultProvider<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( opts: ApolloOfflineVaultOptions<ID,AUTH> ) {
    const vault = opts.vault as  ApolloOfflineVault<Record<string, unknown>, Record<string, unknown>>;
    const children = opts.children;
    const client = vault?.client;
    return (
        <ApolloVaultContext.Provider value={ vault }>
            <ApolloProvider client={ client }>{children}</ApolloProvider>
        </ApolloVaultContext.Provider>
    );
}
