// filename: src/libs/apollo-vault/utils/print.tree.ts

import {
    OrchestrationNode,
    OrchestrationNodeResponse,
} from "../types";
import {isOrchestrationNodeResponse} from "./typeof";

// --- AUXILIARY TYPES TO AVOID EXPLICIT 'ANY' ---
// Define os tipos concretos mais gerais para os generics I e R
type ConcreteI = Record<string, unknown>;
type ConcreteR = unknown;

// Definindo o tipo de 'linked' recursivo.
type ConcreteLinked = Record<string,
    | OrchestrationNode<ConcreteI, ConcreteLinked, ConcreteR>
    | OrchestrationNode<ConcreteI, ConcreteLinked, ConcreteR>[]
>;

// O tipo de nó para a árvore inicial (OrchestrationNode) que a função deve aceitar
type OrchestrationNodeConcrete = OrchestrationNode<ConcreteI, ConcreteLinked, ConcreteR>;

// O tipo de união que a função de impressão deve aceitar
type PrintableNode = OrchestrationNodeConcrete | OrchestrationNodeResponse;

// Type Guard para distinguir entre um nó inicial e um nó resolvido


export function printOrchestrationTree(
    node: PrintableNode | undefined,
    indent: string = "",
    isLast: boolean = true
) {
    if (!node) return;

    // --- 1. DATA ACCESS NORMALIZATION ---
    let metadataSource: OrchestrationNodeConcrete;
    let responseSource: OrchestrationNodeResponse | undefined;

    // linkedSource is inferred as the union of 'linked' properties from both types
    const linkedSource = isOrchestrationNodeResponse(node) ? node.linked : (node as OrchestrationNodeConcrete).linked;

    if (isOrchestrationNodeResponse(node)) {
        metadataSource = node.node as OrchestrationNodeConcrete;
        responseSource = node;
    } else {
        metadataSource = node as OrchestrationNodeConcrete;
        responseSource = {} as typeof responseSource;
    }

    // --- CONNECTION VARIABLES ---
    const connection = indent === "" ? "" : isLast ? "└──" : "├──";
    const verticalLine = isLast ? "    " : "│   ";

    // --- NODE METADATA ---
    const operationName = (metadataSource.operation?.definitions?.[0] as { name?: { value: string } } | undefined)?.name?.value;
    const keyDisplay = metadataSource.key ? ` (🔑 ${metadataSource.key})` : '';
    const nameDisplay = metadataSource.name ?? operationName ?? 'NO_OP';

    let nodeSymbol;
    if (indent === "") {
        nodeSymbol = '🌲 ROOT';
    } else if (responseSource?.status?.skipped) {
        nodeSymbol = '💨 SKIPPED';
    } else if (!operationName) {
        nodeSymbol = '🚫 NO-OP';
    } else {
        nodeSymbol = '⚡ OPERATION';
    }

    // 1. MAIN LINE (NAME AND TYPE)
    console.log(`${indent}${connection} ${nodeSymbol}: ${nameDisplay}${keyDisplay}`);

    // 2. BEHAVIOR METADATA
    const metadata: string[] = [];

    // --- DEFINITION PROPERTIES (metadataSource) ---
    let variablesDisplay = 'Variables';
    if (metadataSource.variables) {
        const isFunction = typeof metadataSource.variables === 'function';
        const isPromise = metadataSource.variables instanceof Promise;
        variablesDisplay += isFunction ? ': Callback ⚙️' : isPromise ? ': Promise ⏳' : ': Static 📄';
        metadata.push(variablesDisplay);
    }

    if (typeof metadataSource.skip === 'function') {
        metadata.push('Can Skip: Callback ❓');
    }

    if (metadataSource.breaker || metadataSource.onFailure) {
        const breakerInfo = metadataSource.breaker ? 'Breaker: Yes 🚨' : 'Breaker: No';
        const failureInfo = metadataSource.onFailure ? `| On Failure: ${metadataSource.onFailure.toUpperCase()}` : '';
        metadata.push(`${breakerInfo} ${failureInfo}`);
    }

    if (metadataSource.parallel) {
        metadata.push('Execution: PARALLEL 🚀');
    }

    if (metadataSource.BYPASS) {
        metadata.push('FLAG: BYPASS ENABLED 🚪');
    }

    // --- EXECUTION PROPERTIES (responseSource) ---
    if (responseSource) {
        // Status and Eventual Delivery
        if (responseSource.ExistsEventualDeliveryTask) {
            metadata.push('Status: EVENTUAL DELIVERY 📦');
        } else if (responseSource.data) {
            metadata.push('Status: RESOLVED ✅');
        } else if (responseSource.errors && responseSource.errors.length > 0) {
            metadata.push(`Status: ERROR (${responseSource.errors.length}x) ❌`);
        } else if (responseSource.status?.skipped) {
            metadata.push('Status: SKIPPED 💨');
        }

        // Execution time
        if (responseSource.status?.time !== undefined) {
            metadata.push(`Time: ${responseSource.status.time}ms ⏱️`);
        }
    }


    // Printing metadata
    if (metadata.length > 0) {
        const parentIndent = indent.slice(0, -4);
        const lineContinuationPrefix = isLast ? "    " : "│   ";
        const metaPrefix = indent === "" ? "" : parentIndent + lineContinuationPrefix;
        console.log(`${metaPrefix}    ${metadata.join(' | ')}`);
    }

    // 3. CHILDREN (LINKED NODES)
    const linkedKeys = Object.keys(linkedSource ?? {});
    const childrenIndent = indent + verticalLine;

    linkedKeys.forEach((key, index) => {
        const linked = linkedSource![key];
        const isList = Array.isArray(linked);
        const isLastChildField = index === linkedKeys.length - 1;
        const fieldPrefix = isLastChildField ? "└──" : "├──";

        // Printing Linked Field
        console.log(`${childrenIndent}${fieldPrefix} 🔗 FIELD '${key}'${isList ? ' [LIST]' : ''}:`);

        // Type assertion for PrintableNode[] or [PrintableNode]
        const children = isList ? (linked as PrintableNode[]) : [linked as PrintableNode];

        const recurseIndent = childrenIndent + (isLastChildField ? "    " : "│   ");


        children.forEach((item: PrintableNode, itemIndex: number) => {
            const isLastItem = isList && itemIndex === children.length - 1;

            if (isList) {
                const itemConnection = isLastItem ? "└──" : "├──";
                console.log(`${recurseIndent}${itemConnection} 📦 ITEM [${itemIndex}]:`);

                const itemRecurseIndent = recurseIndent + (isLastItem ? "    " : "│   ");
                // CORREÇÃO: Passando isLastItem, e não 'true', para garantir que a linha vertical continue até o último item.
                printOrchestrationTree(item, itemRecurseIndent, isLastItem);
            } else {
                printOrchestrationTree(item, recurseIndent, isLastChildField);
            }
        });
    });
}