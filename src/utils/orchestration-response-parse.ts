import {OrchestrationNodeResponse} from "../types";
import {APOLLO_VAULT_SIMBOLS} from "./symbols";
import {ParseOptions} from "../link/orchestration";

export function OrchestrationResponseParse(node: OrchestrationNodeResponse, options: ParseOptions, parent?:Record<string|symbol, unknown>, root?:Record<string|symbol, unknown>): Record<string|symbol, unknown> {
    if( node.errors ){
        const error = new Error("Operation failed" );
        error.cause = node.errors;
        return error as unknown as Record<string, unknown>;
    }
    const response = node.data??{};
    const keys = Object.keys(response);
    const linked = Object.entries( node.linked??{} );
    const field = keys[0];
    const value = response[field as keyof typeof response] as unknown;
    // if( !linked.length ) return value as Record<string, unknown>;

    const parsed:Record<string|symbol, unknown> = {};
    if( !root ) root = parsed;
    linked.forEach( ([field, child]) => {
        if( Array.isArray( child ) ) {
            const parsedList:unknown[] = [];
            child.forEach( next => parsedList.push( OrchestrationResponseParse( next, options ) ) );
            parsed[field] = parsedList;
        } else parsed[field] = OrchestrationResponseParse( child, options, parsed, root );
    });

    parsed[APOLLO_VAULT_SIMBOLS.$] = value;
    parsed[APOLLO_VAULT_SIMBOLS.DATA] = node.data;
    parsed[APOLLO_VAULT_SIMBOLS.EXTENSION] = node.extensions;
    parsed[APOLLO_VAULT_SIMBOLS.ERROR] = node.errors;
    parsed[APOLLO_VAULT_SIMBOLS.ROOT] = root;
    parsed[APOLLO_VAULT_SIMBOLS.PARENT] = parent;
    return parsed;
}