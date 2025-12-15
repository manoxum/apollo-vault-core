// filename: src/libs/apollo-vault/link/cache.ts

// =====================================================
// 🔹 Cache manual por operação (Link customizado)
import {ApolloLink, Observable} from "@apollo/client";
import {ExecutionResult} from "graphql/execution";
import {print} from "graphql/index";
import { deterministicSha256 } from "../utils/sha";
import {CachedQueryInclusion, CachedQueryResponse, ApolloVaultService} from "../types";

const KEYMOUNT:CachedQueryInclusion[] = [
    "operation",
    "query",
    "identity",
    "variables",
    "context",
];



export function CreateCacheControlLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink((operation, forward) => {
        const OPERATION = operation.operationName ?? "UnnamedQuery";
        const context = operation.getContext() ?? {};
        const variables = operation.variables??{};
        const { CachedQuery, UseIdentity } = context;
        const noKeep = context.noKeep === true;
        const useIdentity= (UseIdentity ?? instance.status.UseIdentity) as keyof ID;
        const identity  = instance.status.identity?.[useIdentity];

        return new Observable<ExecutionResult>((observer) => {
            (async () => {
                try {
                    const health = (await instance.status.isHealthy());
                    await instance.status.ready;

                    const isQuery = operation.query.definitions.some(
                        (def) =>
                            def.kind === "OperationDefinition" && def.operation === "query"
                    );

                    const queryText = print(operation.query);

                    const KEYRESOLVE:{[ k in  CachedQueryInclusion]:()=>unknown} = {
                        operation(){
                            return OPERATION
                        }, identity() {
                            return identity
                        }, query() {
                            return queryText
                        }, variables(){
                            return variables
                        }, context(){
                            let ctx:Record<string, unknown> = {};
                            if( typeof CachedQuery?.fromContext === "function" ) ctx = CachedQuery.fromContext( context );
                            return ctx ?? {};
                        }
                    } as const;

                    // ---------- Hashes determinísticos ----------
                    const exclusion = !CachedQuery?.excludes || !CachedQuery?.excludes.length? []
                        : Array.isArray( CachedQuery?.excludes )? CachedQuery?.excludes
                        : CachedQuery?.excludes?.length ? [ CachedQuery?.excludes ]
                        : [];

                    const inputs = Object.fromEntries(  KEYMOUNT
                        .filter( value => !exclusion?.includes(value) )
                        .map( key => ([ (key as string), KEYRESOLVE[key]()] as const) )
                    );


                    const { hash, serialized } = deterministicSha256( inputs, CachedQuery?.serialize );

                    const cacheKey = `${OPERATION}_${hash}`;

                    let cached = await instance?.ApolloQueryCached?.getItem<CachedQueryResponse>(cacheKey);
                    if (cached && !cached?.response?.data) {
                        cached = null;
                        await instance.ApolloQueryCached?.removeItem(cacheKey);
                    }

                    const useCache =
                        CachedQuery?.mode === "cache-first" ? true
                        : CachedQuery?.mode === "no-cache" ? false
                        : CachedQuery?.mode === "update" ? false
                        : !health;


                    const FromCache = useCache && isQuery && !!cached && "data" in (cached?.response??{});
                    if (FromCache) {
                        cached!.score = cached!.score + 1;
                        await instance.ApolloQueryCached?.setItem( cacheKey, cached );
                        const response = cached!.response;
                        observer.next({
                            data: response?.data,
                            extensions: {
                                ...response?.extensions??{},
                                Cached: cached
                            }
                        });
                        observer.complete();
                        return;
                    }

                    const start = performance.now();
                    const sub = forward( operation ).subscribe({
                        next: async (result) => {
                            const duration = performance.now() - start;
                            if (!result.errors && isQuery && !noKeep) {
                                const instant = new Date();
                                const now = new Date();
                                const ttl = CachedQuery?.ttl ?? undefined;
                                const expiration = ttl ? now.getTime() + ttl : undefined;
                                const useIdentity= (UseIdentity ?? instance.status.UseIdentity) as keyof ID;
                                const identity  = instance.status.identity?.[useIdentity];

                                const entry: CachedQueryResponse = {
                                    response: {
                                        ... result,
                                    },
                                    query: queryText,
                                    moment: instant.toISOString(),
                                    operation: OPERATION,
                                    instante: instant.getTime(),
                                    score: (cached?.score ?? 0) + 1,
                                    duration,
                                    source: "network",
                                    partial: !!result.extensions?.hasNext,
                                    identity: identity as string,
                                    useIdentity: useIdentity as string,
                                    variables: variables,
                                    ttl,
                                    expiration,
                                    ...(result.extensions ? { extensions: result.extensions } : {}),
                                    hash: {
                                        calculated: hash,
                                        inputs,
                                        serialized
                                    }
                                } as CachedQueryResponse;

                                try {
                                    entry.size = new Blob([JSON.stringify(entry)]).size;
                                } catch {
                                    entry.size = undefined;
                                }

                                instance.ApolloQueryCached?.setItem(cacheKey, entry).catch((err) => {
                                    console.warn("[CacheControlLink] Falha ao salvar cache:", err);
                                });
                            }
                            observer.next(result as ExecutionResult);
                        },
                        error: (err) => observer.error(err),
                        complete: () => observer.complete(),
                    });

                    return () => sub.unsubscribe();
                } catch (err) {
                    observer.error(err);
                }
            })();
        });
    });
}

