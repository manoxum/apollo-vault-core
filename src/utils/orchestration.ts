// filename: src/libs/apollo-vault/utils/orchestration.ts

import {
    OrchestrationLinkedResolver,
    OrchestrationLinkedResolverClass
} from "../types";
import  * as Path from "path";

export function getCallerFile(stackLevel = 2): string {
    // Se não estiver em Node (ex: React), não funciona → devolver "<browser>"
    if (typeof window !== "undefined") {
        return "<browser>";
    }

    const oldPrepare = Error.prepareStackTrace;

    try {
        Error.prepareStackTrace = (_, stack) => stack;
        const err = new Error();
        const stack = err.stack as unknown as NodeJS.CallSite[];

        const caller = stack[stackLevel];
        const file = caller?.getFileName() ?? "<unknown>";

        return Path.relative(process.cwd(), file);
    } finally {
        Error.prepareStackTrace = oldPrepare;
    }
}


export function orchestrate<
    I extends { [k in keyof I]: I[k] },
>(){

    // 1. sync:root (Anteriormente: "node")

    function root<R, T extends { [k: string]: unknown } >(
        node: OrchestrationLinkedResolver<I, T, R, "sync:root">
    ): OrchestrationLinkedResolver<I, T, R, "sync:root"> ;
    function root<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "func:root">
    ): OrchestrationLinkedResolver<I, T, R, "func:root">;

    function root<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "func:async:root">
    ): OrchestrationLinkedResolver<I, T, R, "func:async:root">;

    function root<R, T extends { [k: string]: unknown }, C extends OrchestrationLinkedResolverClass>(
        node: OrchestrationLinkedResolver<I, T, R, C>
    ): OrchestrationLinkedResolver<I, T, R, C> {
        return node;
    }

    // 1. sync:root (Anteriormente: "node")
    function asyncRoot<R, T extends { [k: string]: unknown } >(
        node: OrchestrationLinkedResolver<I, T, R, "async:root">
    ): OrchestrationLinkedResolver<I, T, R, "async:root"> ;


    function asyncRoot<R, T extends { [k: string]: unknown } >(
        node: OrchestrationLinkedResolver<I, T, R, "async:root">
    ): OrchestrationLinkedResolver<I, T, R, "async:root"> {
        return node;
    }

    // 1. sync:node (Anteriormente: "node")
    function node<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "sync:node">
    ): OrchestrationLinkedResolver<I, T, R, "sync:node">;


    function node<R, T extends { [k: string]: unknown }, C extends OrchestrationLinkedResolverClass>(
        node: OrchestrationLinkedResolver<I, T, R, C>
    ): OrchestrationLinkedResolver<I, T, R, C> {
        return node;
    }

    // 2. sync:list (Anteriormente: "list")
    function list<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "sync:list">
    ): OrchestrationLinkedResolver<I, T, R, "sync:list">;

    function list<R, T extends { [k: string]: unknown }, C extends OrchestrationLinkedResolverClass>(
        node: OrchestrationLinkedResolver<I, T, R, C>
    ): OrchestrationLinkedResolver<I, T, R, C> {
        return node;
    }

    // 1. sync:node (Anteriormente: "node")
    function async<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "async:node">
    ): OrchestrationLinkedResolver<I, T, R, "async:node">;

    // 2. sync:list (Anteriormente: "list")
    function async<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "async:list">
    ): OrchestrationLinkedResolver<I, T, R, "async:list">;

    function async<R, T extends { [k: string]: unknown }, C extends OrchestrationLinkedResolverClass>(
        node: OrchestrationLinkedResolver<I, T, R, C>
    ): OrchestrationLinkedResolver<I, T, R, C> {
        return node;
    }

    // 5. func:node (Anteriormente: "function:node")
    function fn<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "func:node">
    ): OrchestrationLinkedResolver<I, T, R, "func:node">;

    // 6. func:list (Anteriormente: "function:list")
    function fn<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "func:list">
    ): OrchestrationLinkedResolver<I, T, R, "func:list">;

    // 7. func:async:node (Anteriormente: "function:promise:node")
    function fn<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "func:async:node">
    ): OrchestrationLinkedResolver<I, T, R, "func:async:node">;

    // 8. func:async:list (Anteriormente: "function:promise:list")
    function fn<R, T extends { [k: string]: unknown }>(
        node: OrchestrationLinkedResolver<I, T, R, "func:async:list">
    ): OrchestrationLinkedResolver<I, T, R, "func:async:list">;

    // Implementação da função (deve ser a última e mais genérica)
    function fn<R, T extends { [k: string]: unknown }, C extends OrchestrationLinkedResolverClass>(
        node: OrchestrationLinkedResolver<I, T, R, C>
    ): OrchestrationLinkedResolver<I, T, R, C> {
        return node;
    }

    return {node,  fn, async, list, root, asyncRoot};
}


export function registry(index: URL, registry: URL, ... path:string[]):`registry://${string}:${string}`
export function registry(index: URL, registry: URL, ... path:string[]):`registry://${string}:${string}`
export function registry(index: URL, registry: URL, ... path:string[]):`registry://${string}:${string}`{
    const cwd = Path.dirname( index.pathname );
    const filename  = Path.join( Path.relative( cwd, registry.pathname ) );
    return `registry://${filename}:${path.join("-")}` as const;
}