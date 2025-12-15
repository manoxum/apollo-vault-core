// filename: src/libs/apollo-vault/utils/operation.ts

import {ApolloLink, DocumentNode} from "@apollo/client";

export function isQueryOperation( document: DocumentNode ){
    // Determina o tipo de operação (Permanece igual)
    return document.definitions.some(
        (def) => def.kind === "OperationDefinition" && def.operation === "query"
    );
}
export function isMutationOperation( document: DocumentNode ){
    // Determina o tipo de operação (Permanece igual)
    return document.definitions.some(
        (def) => def.kind === "OperationDefinition" && def.operation === "mutation"
    );
}

export function OperationName( operation: ApolloLink.Operation ){
    const name = operation.operationName;
    if( !!name ) return name;
    if( isQueryOperation( operation.query ) ) return "UnnamedQuery";
    else if( isMutationOperation( operation.query ) ) return "UnnamedMutation";
    else return "UnknownOperation";

}