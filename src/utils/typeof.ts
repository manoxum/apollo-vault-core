// filename: src/libs/apollo-vault/utils/typeof.ts



// Definimos a União de Tipos de Entrada
import {OrchestrationNode, OrchestrationNodeResponse} from "../types";

export type OrchestrationInput<I, N, R> =
    | OrchestrationNode<I, N, R>
    | OrchestrationNodeResponse;

/**
 * Type Guard (Predicador de Tipo) que determina se a entrada é um OrchestrationNodeResponse.
 * @param input O objeto a ser verificado.
 * @returns true se for um OrchestrationNodeResponse, false caso contrário.
 */
export function isOrchestrationNodeResponse<I, N, R>(
    input: OrchestrationInput<I, N, R>
): input is OrchestrationNodeResponse {

    const hasStatus = (input as OrchestrationNodeResponse).status !== undefined;
    const hasData = (input as OrchestrationNodeResponse).data !== undefined;
    const isNode = (input as OrchestrationNode<I, N, R>).operation !== undefined;

    return (hasStatus || hasData) && !isNode;
}


/**
 * Type Guard que determina se a entrada é um OrchestrationNode (o grafo de execução).
 * @param input O objeto a ser verificado.
 * @returns true se for um OrchestrationNode, false caso contrário.
 */
export function isOrchestrationNode<I, N, R>(
    input: OrchestrationInput<I, N, R>
): input is OrchestrationNode<I, N, R> {

    // O OrchestrationNode tem a propriedade 'operation' (o DocumentNode da query/mutation)
    return (input as OrchestrationNode<I, N, R>).operation !== undefined;
}