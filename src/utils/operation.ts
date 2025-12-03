// filename: src/libs/apollo-vault/utils/operation.ts

import {DocumentNode} from "@apollo/client";

export function isQueryOperation( operation: DocumentNode ){
    // Determina o tipo de operação (Permanece igual)
    return operation.definitions.some(
        (def) => def.kind === "OperationDefinition" && def.operation === "query"
    );
}
export function isMutationOperation( operation: DocumentNode ){
    // Determina o tipo de operação (Permanece igual)
    return operation.definitions.some(
        (def) => def.kind === "OperationDefinition" && def.operation === "mutation"
    );
}