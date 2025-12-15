// filename: src/libs/apollo-vault/types.ts


// =====================================================
// 🔹 Tipagem global para evitar 'any'
import {
    ApolloClient,
    ApolloLink,
    DefaultContext,
    DocumentNode,
    HttpLink,
} from "@apollo/client";
import {ExecutionResult, FormattedExecutionResult} from "graphql/execution";
import React from "react";
import Operation = ApolloLink.Operation;
import type {useQuery} from "@apollo/client/react";
import type {UPDATABLE_FIELDS} from "./updatable";
import {GraphQLError} from "graphql/index";

declare global {
    interface Window {
        ApolloQueryCached?: LocalForage;
        ApolloEventualDelivery?: LocalForage;
        ApolloEventualDeliverySolved?: LocalForage;
    }
}

declare module "@apollo/client" {
    export interface DefaultContext {
        headers?: Record<string, string> & {
            authorization?:string
        };
        transport?: "http/fetch"|"default";
        fetchOptions?:  RequestInit & {
            "Content-Type"?:string
        }&Record<string, unknown>,
        EventualDelivery?: EventualDeliveryContext<Record<string, unknown>,Record<string, unknown>>
        UseIdentity?:string
        UseUnauthenticatedCode?:"UNAUTHENTICATED"|string
        CachedQuery?: CachedQueryContext
        OrchestrationNode?: OrchestrationNode<Record<string, unknown>,Record<string, unknown>,unknown>
        WaitAuthentication?: {
            BYPASS?: boolean;
            timeout?: number;
            attempts?: number;
            attemptsCount?: number;
        }
    }

    export type ExtensionResponses = {
        EventualDeliveryResponse? :EventualDeliveryResponse<Record<string, unknown>,Record<string, unknown>>
        OrchestrationResponse?:{
            response: OrchestrationNodeResponse,
            parsed: Record<string|symbol, unknown>
        }
    }
}

export interface EventualDeliveryContext<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
> {
    eventual?: "on-first-error"|"error"|"always"|"no-healthy"
    tags?:string[]
    retry?: number
    message?: string
    meta?: Record<string, unknown>
    ttl?: number
    BYPASS?:boolean
}
export type EventualDeliveryResponse<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>  = Partial<EventualDeliveryTask<ID,AUTH>> & {
    EventualDelivery?: EventualDeliveryContext<ID,AUTH>,
}


export type CachedQueryInclusion ="identity"|"variables"|"query"|"operation"|"context";
export type Path = (string|number|symbol)[]
export type SerializeObjectCallback<T, P> = (input: T, path: Path ) => P;
export type SerializeObjectOptions = {
    excludes?:Path[]
    orderList?: 'default' | 'none' | SerializeObjectCallback<unknown[], unknown[]>
    orderKeys?: 'default' | 'none' | SerializeObjectCallback<string[], string[]>
}

export interface CachedQueryContext {
    serialize?:SerializeObjectOptions
    fromContext?:( context:DefaultContext )=>Record<string, unknown>
    ttl?:number
    mode?: "cache-first" | "network-first" | "no-cache" | "update"
    noKeep?: boolean
    excludes?: CachedQueryInclusion|(CachedQueryInclusion[])
}



// 🔹 Tipagem do delayed operation
export interface EventualDeliveryTask <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>  {
    identifier?: string;
    mutationName?: string;
    instant?: string
    query: DocumentNode;   // agora tipo correto
    variables?: Record<string, unknown>;
    context?: Record<string, unknown>;
    UseIdentity?: string
    identity?: ID|null
    status?: "ok"|"failed"|"eventual";
    response?:  unknown;
    errors?:unknown
    eventualRetry?:number
    tags?:string[]
    EventualDelivery:EventualDeliveryContext<ID,AUTH>
    eventualRetryCount?:number
    OrchestrationNodeResponse?: OrchestrationNodeResponse;  // Árvore parcial
    OrchestrationPendents?: string[];  // Chaves pendentes
    partialResult?: Record<string, unknown>;  // Resultados parciais
}

export interface CachedQueryResponse {
    query: string;
    instante: number;
    moment: string;
    operation: string;
    ttl?: number;

    // 🔹 Recomendações
    score: number;
    duration?: number;
    expiration?: number;
    size?: number;
    identity:string,
    useIdentity:string,
    variables:unknown,

    // 🔹 Opcionais / avançados
    source?: "network" | "cache";
    partial?: boolean;
    response?: ExecutionResult
}

export type NotifierLevel = "success" |  "info" |  "warning"  | "error" ;
export type ApolloOfflineVaultOptions<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>  = {
    children: React.ReactNode,
    vault: ApolloOfflineVault<ID,AUTH>
}

export type ApolloVaultHandlers = {
    notifier( message:string, level: NotifierLevel):void
    isHealthy( operation?:Operation ):Promise<boolean>
}


export type InstanceStatus<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
> = {
    WaitAuthentication?: {
        timeout?: number;
        attempts?: number;
    }
    UseIdentity?:keyof ID,
    UseUnauthenticatedCode?:"UNAUTHENTICATED"|string
    entries:number
    transport?:TransportLinkOptions
    auth?:AUTH|Promise<AUTH>
    authenticated?:boolean|null|undefined
    identity?:ID|null
    health?:boolean
    isHealthy():Promise<boolean>
    ready?:Promise<boolean>
    handlers:ApolloVaultHandlers
    healthPolicyTTL?:number
    healthPolicyCheckEveryTime?:boolean
    healthLastCheck?:number
}

export type CreateApolloVaultOptions<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>  = Pick<InstanceStatus<ID,AUTH>, UpdatableFields> & {
}


export type NotifyOptions = {
    operation:Operation,
    response?: FormattedExecutionResult<Record<string, unknown>, Record<string, unknown>>
}


export type SubscriptionHandler<T> = ( response:FormattedExecutionResult<T, T>, operation: ApolloLink.Operation )=>void;

export type SubscriptionEvent = "response"|"authenticated"|"unauthenticated";
export type SubscriptionOf<T extends SubscriptionEvent> = T;

export type UpdatableFields =typeof UPDATABLE_FIELDS[number];

export interface OfflineApolloShared<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>  {
    instance: string
    OfflineData:LocalForage,
    ApolloEventualDelivery:LocalForage,
    ApolloEventualDeliverySolved:LocalForage
    ApolloQueryCached:LocalForage
    deliveryEntries(keys:string[]):Promise<OfflineMutationQueueResponse<ID,AUTH>>
    executeOrchestration(
        node: OrchestrationNode<Record<string, unknown>, Record<string, unknown>, unknown>
        | OrchestrationNodeResponse,
    ):Promise<OrchestrationNodeResponse>

    update( option:Partial<Pick<InstanceStatus<ID,AUTH>,  UpdatableFields>>):void
    withHandler( handlers:Partial<ApolloVaultHandlers>):void
    subscribe<T>(event:SubscriptionOf<"response">, handler:SubscriptionHandler<T>):()=>void
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    subscribe<T>(event:SubscriptionOf<"authenticated">, handler:()=>void ):()=>void
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    subscribe<T>(event:SubscriptionOf<"unauthenticated">, handler:()=>void ):()=>void

    registry<I,T,R>( registry:`registry://${string}:${string}`, resolver:OrchestrationLinkedResolverRoot<I,T,R>):Promise<"replaced"| "created">
    eventualDeliveryFromRegistry(registry:string ):Promise<string[]>

}

export interface ApolloVaultServiceInit<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}

>  extends OfflineApolloShared<ID,AUTH>{
    status:InstanceStatus<ID,AUTH>,
    RegistriController:OrchestrationRegistry,
    subscriptions:Record<SubscriptionEvent|`registry://${string}`, Set<CallableFunction>>
    publishResponse(opts:NotifyOptions ):void
    publishAuthenticated():void
    requestAuthentication():void
    createEventual(  entry:EventualDeliveryTask<ID,AUTH> ):Promise<{entry?:EventualDeliveryTask<ID,AUTH>, error?:GraphQLError} >
    updateEventual(  entry:EventualDeliveryTask<ID,AUTH> ):Promise<{entry?:EventualDeliveryTask<ID,AUTH>, error?:GraphQLError} >
    removeEventual(  entry:EventualDeliveryTask<ID,AUTH> ):Promise<{entry?:EventualDeliveryTask<ID,AUTH>, error?:GraphQLError} >
    createEventualFormOrchestration(result: OrchestrationNodeResponse):Promise<{entry?:EventualDeliveryTask<ID,AUTH>, error?:GraphQLError} >
    getOrchestrationRootRegistry( registry:string, args:unknown ):Promise<OrchestrationTreeRoot<Record<string, unknown>, Record<string, unknown>, unknown> | undefined>
}

export interface ApolloVaultService<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}

>  extends OfflineApolloShared<ID,AUTH>, ApolloVaultServiceInit<ID,AUTH> {
    client: ApolloClient
}

export interface OfflineMutationQueueResponse<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
> {
    result:boolean,
    message:string,
    level: NotifierLevel,
    success?:EventualDeliveryTask<ID,AUTH>[],
    failed?:EventualDeliveryTask<ID,AUTH>[],
    eventual?:EventualDeliveryTask<ID,AUTH>[],
}


export interface  ApolloOfflineVault<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>  extends OfflineApolloShared<ID,AUTH> {
    client: ApolloClient
}



export type TransportLinkOptions =   HttpLink.Options & {

}

export type IncrementalOf<T> = {
    [P in keyof T]?: T[P] extends object
        ? T[P] extends Array<infer U>
            ? Array<IncrementalOf<U>>
            : IncrementalOf<T[P]>
        : T[P];
};

export type IncrementalResponse<O, V extends { [ k in keyof V]:V[k] }> =
    useQuery.Result<O, V, "empty" | "complete" | "streaming"> & {
    chunk: number,
    incremental?: IncrementalOf<O>,
    loadingFirst: boolean
};



//==================== Orchestration ====================
export type OrchestrationLinkedNode<
    I extends { [k in keyof I]: I[k] },
    N extends { [ k in keyof N]:(N[k]) },
    R
> =
    (OrchestrationNode<I,N,R>)
    |(OrchestrationNode<I,N,R>[])



export type EventPublish<
    ED extends { [k in keyof ED]: ED[k] extends ((...args: infer P) => unknown) ? ED[k] : never }
> = {
    publish<E extends keyof ED>( event:E, ...args: ( ED[E] extends ((...args: infer P) => unknown) ? P : never)  ):void
    publishOneByOne<E extends keyof ED>( event:E, ...args: ( ED[E] extends ((...args: infer P) => unknown) ? P : never)  ):void
}


export type EventSubscritor<
    ED extends { [k in keyof ED]: ED[k] extends ((...args: infer P) => unknown) ? ED[k] : never }
> = {
    subscribe<E extends keyof ED>( event:E, handler:ED[E] ):()=>void
    once<E extends keyof ED>( event:E, handler:ED[E] ):()=>void
}

export type SubscriptionChannels<
    ED extends { [k in keyof ED]: ED[k] extends ((...args: infer P) => unknown) ? ED[k] : never }
> = {
    subscriptions:Record<keyof ED, Set<ED[keyof ED]>>
    pub:EventPublish<ED>,
    sub:EventSubscritor<ED>
}

export type OrchestrationEventDefinitions<
    I extends { [k in keyof I]: I[k] },
    NT,
    R,
> = {


    /**
     *
     * @param node
     */
    eventual( node:OrchestrationNode<I,NT,R> ):void,


    /**
     *
     * @param ctx
     * @param previews
     * @param parent
     * @param root
     */
    eventualized(ctx:I, previews:OrchestrationNodeResponse, parent?:OrchestrationNodeResponse, root?: OrchestrationNodeResponse ):void

    /**
     *
     * @param node
     */
    begin( node:OrchestrationNode<I,NT,R> ):void,

    /**
     *
     * @param node
     */
    ["started:resolve"]( node:OrchestrationNode<I,NT,R> ):void,


    /**
     *
     * @param node
     * @param status
     */
    ["started:completion"]( node:OrchestrationNode<I,NT,R>, status:OrchestrationNodeResponse ):void,


    /**
     *
     * @param response
     */
    resolved( response:OrchestrationNodeResponse ):void,


    /**
     *
     * @param response
     */
    completed( response:OrchestrationNodeResponse ):void,

    /**
     *
     * @param response
     * @param node
     */
    end( response:OrchestrationNodeResponse, node:OrchestrationNode<I,NT,R> ):void,

}



export type OrchestrationSubscription<
    I extends { [k in keyof I]: I[k] },
    NT,
    R,
> = EventSubscritor<OrchestrationEventDefinitions<I, NT, R>> & {}

export type OrchestrationRegistry =  {
    registries:Record<string, OrchestrationLinkedResolverRoot<Record<string, unknown>,Record<string, unknown>,unknown>>
    registry<I,T,R>( registry:string, resolver:OrchestrationLinkedResolverRoot<I,T,R>):Promise<"replaced"| "created">
}

export interface Orchestration<
    I extends { [k in keyof I]: I[k] },
    NT,
    R,
> {
    operation: DocumentNode
        | Promise<DocumentNode>
        | ( <V extends {[k in keyof V]:V[k]}>( ctx:I, parent?:OrchestrationNodeResponse, root?: OrchestrationNodeResponse) => DocumentNode|Promise<DocumentNode>)

    variables?:
        ( Record<string, unknown> | Promise<Record<string, unknown>> )
        | ( <V extends {[k in keyof V]:V[k]}>( ctx:I, parent?:OrchestrationNodeResponse, root?: OrchestrationNodeResponse) => unknown | Promise<unknown>)
    ;
    breaker?: BreakerFunction;
    onFailure?: "break" | "continue";
    parallel?: boolean;
    skip?: ( ctx?:I, parent?:OrchestrationNodeResponse, root?: OrchestrationNodeResponse) => boolean|Promise<boolean>;
    BYPASS?: boolean;
    name?:string
    subscription?:(subscriber:OrchestrationSubscription<I, NT, R>) => void
    eventualize?: ( <V extends {[k in keyof V]:V[k]}>(ctx:I, previews:OrchestrationNodeResponse, parent?:OrchestrationNodeResponse, root?: OrchestrationNodeResponse) => "rejected"|"accepted"|Promise<"rejected"|"accepted">)
    key?:string
}

export interface OrchestrationRoot<
    I extends { [k in keyof I]: I[k] },
> {
    registry: string;
    context?:
        ( Omit<DefaultContext, "OrchestrationTree"> | Promise<Omit<DefaultContext, "OrchestrationTree">> )
        | ( <V extends {[k in keyof V]:V[k]}>( ctx:I, parent?:OrchestrationNodeResponse, root?: OrchestrationNodeResponse) => Omit<DefaultContext, "OrchestrationTree">|Promise<Omit<DefaultContext, "OrchestrationTree">>)


    arguments?:Record<string, unknown>
}


export interface OrchestrationNode<
    I extends { [k in keyof I]: I[k] },
    N extends { [ k in keyof N]:(N[k]) },
    R,
> extends Orchestration<I, N, R>, OrchestrationRoot<I> {
    SubscriptionChannels:SubscriptionChannels<OrchestrationEventDefinitions<I, N, R>>
    linked?: {[k in keyof N]: N[k] & OrchestrationLinkedNode<I,N,R>};
}


export interface OrchestrationTree<
    I extends { [k in keyof I]: I[k] },
    T,
    R,
> extends Orchestration<I,T,R> {
    linked?:T;
}

export interface OrchestrationTreeRoot<
    I extends { [k in keyof I]: I[k] },
    T,
    R,
> extends OrchestrationTree<I,T,R>, OrchestrationRoot<I>{}

export type OrchestrationLinkedResolverClass =
// Síncronos
    "sync:node"
    | "sync:list"
    | "sync:root"

    // Assíncronos (Promessas Diretas)
    | "async:node"
    | "async:list"
    | "async:root"

    // Funções Síncronas (Retorno direto)
    | "func:node"
    | "func:list"
    | "func:root"

    // Funções Assíncronas (Retorno de Promessa)
    | "func:async:node"
    | "func:async:list"
    | "func:async:root"
;

export type OrchestrationLinkedResolverRoot<
    I extends { [k in keyof I]: I[k] },
    T extends { [ k in keyof T]:(T[k]) },
    R,
> = OrchestrationLinkedResolver<I, T, R,"sync:root"|"async:root">


export type OrchestrationLinkedResolver<
    I extends { [k in keyof I]: I[k] },
    T extends { [ k in keyof T]:(T[k]) },
    R,
    C extends OrchestrationLinkedResolverClass = "sync:node" // Default alterado
> =
// SÍNCRONOS
    C extends "sync:node" ?  OrchestrationTree<I,T,R>
    : C extends "sync:root" ?  OrchestrationTreeRoot<I,T,R>
    : C extends "sync:list" ?  OrchestrationTree<I,T,R>[]

    // ASSÍNCRONOS (Promise)
    : C extends "async:node" ? Promise<OrchestrationTree<I,T,R>>
    : C extends "async:root" ? Promise<OrchestrationTreeRoot<I,T,R>>
    : C extends "async:list" ? Promise<OrchestrationTree<I,T,R>[]>

    // FUNÇÕES SÍNCRONAS
    : C extends "func:node" ? ( ctx?:I ) => OrchestrationTree<I,T,R>
    : C extends "func:root" ? ( ctx?:I ) => OrchestrationTreeRoot<I,T,R>
    : C extends "func:list" ? ( ctx?:I ) => OrchestrationTree<I,T,R>[]

    // FUNÇÕES ASSÍNCRONAS
    : C extends "func:async:node" ? ( ctx?:I ) => Promise<OrchestrationTree<I,T,R>>
    : C extends "func:async:root" ? ( ctx?:I ) => Promise<OrchestrationTreeRoot<I,T,R>>
    : C extends "func:async:list" ? ( ctx?:I ) => Promise<OrchestrationTree<I,T,R>[]>

    // Fallback
    : OrchestrationTree<I,T,R>
    ;


export type BreakerFunction = <
    I extends { [k in keyof I]: I[k] },
    R
>(result: ExecutionResult<R>, parent: unknown, root: Record<string, unknown>) => Promise<void> | void;

export type OrchestrationNodeResponse = {
    node?: OrchestrationNode<Record<string, unknown>, Record<string, unknown>, unknown>
        | OrchestrationTreeRoot<Record<string, unknown>, Record<string, unknown>, unknown>
    registry:string,
    status?:{
        previewResolved?: boolean,
        start?: number,
        end?: number,
        time?: number,
        variables?:Record<string, unknown>
        context?: DefaultContext
        skipped?:boolean
        resolved?:boolean
        complete?:boolean
        arguments?: Record<string, unknown>,
    }
    data?: unknown;
    extensions?: Record<string, unknown>;
    errors?: readonly GraphQLError[];
    linked?: Record<string, OrchestrationNodeResponse|OrchestrationNodeResponse[]>;
    parent?: OrchestrationNodeResponse
    ExistsEventualDeliveryTask?: boolean
}


export type ApolloVaultServiceLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
> = ( service: ApolloVaultService<ID, AUTH> ) => ApolloLink