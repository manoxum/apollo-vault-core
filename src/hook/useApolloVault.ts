// filename: src/libs/apollo-vault/hook/useApolloVault.ts

import {Context, useContext} from "react";
import {ApolloVaultContext} from "../provider";
import {ApolloOfflineVault} from "../types";
export function useApolloVault<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>() {
    const context = useContext(ApolloVaultContext as  Context<ApolloOfflineVault<ID,AUTH> | undefined>);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
