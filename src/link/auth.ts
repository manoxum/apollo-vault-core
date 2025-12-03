// filename: src/libs/apollo-vault/link/auth.ts

import {ApolloLink, Observable} from "@apollo/client";
import {ApolloVaultService} from "../types";

export function CreateAuthorizationLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink((operation, forward) => {
        return new Observable(observer => {
            (async () => {
                try {
                    const  context = operation.getContext();
                    const RequestAuthorization = context.RequestAuthorization??{};
                    const authorization = instance.status?.auth??{}

                    operation.setContext(prevContext => ({
                        ...prevContext,
                        headers: {
                            ... (prevContext?.headers ?? {}),
                            ... authorization,
                            ... RequestAuthorization
                        }
                    }));

                    forward(operation).subscribe(observer);
                } catch (err) {
                    observer.error(err);
                }
            })();
        });
    });
}
