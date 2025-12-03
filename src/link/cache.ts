// filename: src/libs/apollo-vault/link/cache.ts

// =====================================================
// 🔹 Cache manual por operação (Link customizado)
import {ApolloLink, Observable} from "@apollo/client";
import {ExecutionResult} from "graphql/execution";
import {print} from "graphql/index";
import {createHashFromObject, sha256Truncated} from "../utils/sha";
import {CachedQueryInclusion, CachedQueryResponse, ApolloVaultService} from "../types";
import {serializeObject} from "../utils/serialize";

const KEYMOUNT:CachedQueryInclusion[] = [ "identity", "query", "variables", "operation" ];



export function CreateCacheControlLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink((operation, forward) => {
        const OPERATION = operation.operationName ?? "UnnamedQuery";
        const context = operation.getContext() ?? {};
        const { CachedQuery } = context;
        const noKeep = context.noKeep === true;

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

                    const KEYRESOLVE:{[ k in  CachedQueryInclusion]:(  )=>string} = {
                        identity(){
                            const { UseIdentity } = operation.getContext();
                            const useAuthorization= (UseIdentity ?? instance.status.UseIdentity) as keyof ID;
                            const auth  = instance.status.identity?.[useAuthorization];
                            return sha256Truncated(auth, 16)
                        }, query() {
                            const queryHash = sha256Truncated(queryText, 8);
                            return `?${queryHash}`;
                        }, variables(){
                            const variables = serializeObject(operation.variables);
                            const variablesHash = createHashFromObject(variables, 24);
                            return `?${variablesHash}`;
                        }, operation(){
                            const OPERATION = operation.operationName ?? "UnnamedQuery";
                            return `/${OPERATION}`;
                        }
                    } as const;

                    // ---------- Hashes determinísticos ----------
                    const exclusion = !CachedQuery?.excludes || !CachedQuery?.excludes.length? []
                        : Array.isArray( CachedQuery?.excludes )? CachedQuery?.excludes
                        : CachedQuery?.excludes?.length ? [ CachedQuery?.excludes ]
                        : [];

                    const cacheKey = KEYMOUNT.filter( value => !exclusion?.includes(value) )
                        .map(key => KEYRESOLVE[key]())
                        .join("")


                    let cached = await instance?.ApolloQueryCached?.getItem<CachedQueryResponse>(cacheKey);
                    if (cached && !cached?.response?.data) {
                        cached = null;
                        await instance.ApolloQueryCached?.removeItem(cacheKey);
                    }

                    const useCache =
                        CachedQuery?.mode === "cache-first"
                            ? true
                            : CachedQuery?.mode === "no-cache"
                                ? false
                                : !health;

                    if (useCache && isQuery && cached && "data" in (cached?.response??{})) {
                        cached.score = cached.score + 1;
                        await instance.ApolloQueryCached?.setItem(cacheKey, cached);
                        const response = cached.response;
                        delete cached.response;
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
                    const sub = forward(operation).subscribe({
                        next: async (result) => {
                            const duration = performance.now() - start;

                            if (!result.errors && isQuery && !noKeep) {
                                const instant = new Date();
                                const now = new Date();
                                const ttl = CachedQuery?.ttl ?? undefined;
                                const expiration = ttl ? now.getTime() + ttl : undefined;

                                const entry: CachedQueryResponse = {
                                    response: {
                                        data: result.data,
                                        extensions: result.extensions,
                                        errors: result.errors,
                                    },
                                    query: queryText,
                                    moment: instant.toISOString(),
                                    operation: OPERATION,
                                    instante: instant.getTime(),
                                    score: (cached?.score ?? 0) + 1,
                                    duration,
                                    source: "network",
                                    partial: !!result.extensions?.hasNext,
                                    ttl,
                                    expiration,
                                    ...(result.extensions ? { extensions: result.extensions } : {}),
                                };

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

