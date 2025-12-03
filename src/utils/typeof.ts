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

    // Verificamos a presença da propriedade 'status' para distinguir.
    // 'status' é uma propriedade opcional (com '?') em OrchestrationNodeResponse,
    // mas é um bom discriminador porque não existe em OrchestrationNode.

    // Além disso, verificamos 'data' que é o resultado da execução.

    // Como 'status' e 'data' são opcionais em OrchestrationNodeResponse,
    // a verificação mais forte é se 'data' ou 'status' existe E se 'operation' (do Node) NÃO existe.

    // Uma abordagem mais simples e robusta: OrchestrationNodeResponse tem 'registry' e 'status'
    // OrchestrationNode também tem 'registry', mas OrchestrationNodeResponse tem 'status'.

    const hasStatus = (input as OrchestrationNodeResponse).status !== undefined;
    const hasData = (input as OrchestrationNodeResponse).data !== undefined;

    // O OrchestrationNode *não* tem 'status' nem 'data' no seu nível superior,
    // mas o OrchestrationNodeResponse tem.

    // Se a propriedade 'operation' do *Node* for encontrada, então é um Node, não um Response.
    // Se 'status' (do Response) for encontrada, então é um Response, não um Node.
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