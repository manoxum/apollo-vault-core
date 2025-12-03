// filename: src/libs/apollo-vault/utils/symbols.ts

export const APOLLO_VAULT_SIMBOLS = {
    $: Symbol("$" ),
    DATA: Symbol("DATA" ),
    ERROR: Symbol("ERROR" ),
    ROOT: Symbol("ROOT" ),
    PARENT: Symbol("PARENT" ),
    EXTENSION: Symbol("EXTENSION" ),
}

const $ = APOLLO_VAULT_SIMBOLS.$;

export function data<R>( parsed:Record<string|symbol, unknown> ):R{
    return parsed[APOLLO_VAULT_SIMBOLS.DATA] as R;
}

export function error( parsed:Record<string|symbol, unknown> ){
    return parsed[APOLLO_VAULT_SIMBOLS.ERROR];
}

export function pick<R>( parsed:Record<string|symbol, unknown>, picker?:string):R{
    if( !picker ) return parsed[$] as R;
    const d = data(parsed);
    return  d ?.[picker as keyof typeof d] as R;
}



