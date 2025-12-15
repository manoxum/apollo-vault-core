import {
    ApolloVaultHandlers,
    ApolloVaultService,
    ApolloVaultServiceInit,
    CreateApolloVaultOptions,
    InstanceStatus,
    NotifyOptions,
    OrchestrationLinkedResolverRoot,
    OrchestrationRegistry,
    SubscriptionEvent,
    SubscriptionHandler
} from "../types";
import {nanoid} from "nanoid";
import {FormattedExecutionResult} from "graphql/execution";
import {UPDATABLE_FIELDS} from "../updatable";
import {OpenStorages} from "../storage";
import {DeliveryPendentEntriesService} from "./EventualExecution";
import {ExecuteOrchestrationEventually, ExecuteOrchestrationService} from "./orchestration";
import {
    CreateEventualEntry,
    CreateEventualEntryFromNodeOrchestration,
    EventualDeliveryOrchestrationFromRegistry, RemoveEventualEntry, UpdateEventualEntry
} from "./EventualRegistry";
import {isOrchestrationNode, isOrchestrationNodeResponse} from "../utils/typeof";
import {ResolveOrchestrationRoot} from "./OrchestrationRoot";

function includesHandlers( handlers:ApolloVaultHandlers, news?:Partial<ApolloVaultHandlers>){
    if( !news ) return;
    Object.entries( news ).forEach(([ name, handler ] ) => {
        if( typeof handler === "function" ) Object.assign(handlers, { [ name ]: handler });
    });
}


export function CreateApolloVaultServices <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
> (
    SCHEMA_VERSION: number = 1,
    opts?:CreateApolloVaultOptions<ID,AUTH>
) {
    const status:InstanceStatus<ID, AUTH> = {
        ...opts??{},
        entries: 0,
        handlers: {
            async isHealthy(): Promise<boolean> {
                return navigator.onLine;
            },
            notifier( message, level) {
                console.log( `[ApolloVault:${level}] ${message}]` );
            }
        },

        async isHealthy(): Promise<boolean> {
            if( !!status.healthPolicyCheckEveryTime ){
                return status.handlers.isHealthy();
            }
            if( status.health === undefined ){
                return status.handlers.isHealthy();
            }

            if( !status.healthPolicyTTL ){
                return status.health;
            }

            if( (status.healthLastCheck??0)+status.healthPolicyTTL > Date.now() ){
                return status.health;
            }

            status.health = await status.handlers.isHealthy();
            status.healthLastCheck = Date.now();
            console.log( "status.health = await status.handlers.isHealthy();", status.health )
            return status.health;
        },
    };

    if( opts?.health !== undefined ){
        status.healthLastCheck = Date.now();
    }


    includesHandlers( status.handlers, opts?.handlers );

    const { storages}  = OpenStorages(SCHEMA_VERSION);

    const Registry: OrchestrationRegistry = {
        registries:{},
        async registry<I, T, R>(registry: string, resolver: OrchestrationLinkedResolverRoot<I, T, R>) {
            const exists = !!Registry.registries[ registry ];
            Registry.registries[registry] = (await  resolver) as OrchestrationLinkedResolverRoot<Record<string, unknown>, Record<string, unknown>, unknown>;
            return exists? "replaced": "created"
        }
    }

    const init :ApolloVaultServiceInit<ID,AUTH> = {
        ...storages,
        instance: nanoid(32),
        status,

        RegistriController: Registry,

        subscriptions: new Proxy({}, {
            get(target, p )  {
                const key = p as keyof typeof target;
                let handler = target[ key ];
                if( !handler ) handler = target[ key ] = new Set<SubscriptionHandler<unknown>>() as unknown as typeof target[ typeof key ];
                return handler;
            }
        }) as Record<SubscriptionEvent, Set<CallableFunction>>,

        subscribe( event, handler) {
            service.subscriptions[event].add( handler as SubscriptionHandler<unknown>)
            return ()=>{
                service.subscriptions[event].delete( handler as SubscriptionHandler<unknown> );
            }
        },

        publishResponse(opts: NotifyOptions) {
            service.subscriptions.response.forEach( next => {
                next( opts.response as unknown as FormattedExecutionResult<unknown, unknown>, opts.operation );
            });
        },

        publishAuthenticated() {
            const waiters = [...service.subscriptions.authenticated];
            service.subscriptions.authenticated.clear();
            waiters.forEach((subscriptor) => {
                subscriptor()
            });
        },

        requestAuthentication() {
            service.subscriptions.unauthenticated.forEach( subscriptor => {
                subscriptor();
            });
        },

        update(option ) {
            const keys = Object.keys( option ) as (keyof InstanceStatus<ID,AUTH>)[];
            const newAuthorization = keys.includes("auth" )
                && option.auth !== status.auth
            ;
            UPDATABLE_FIELDS.forEach( value => {
                if( !keys.includes( value ) ) return;
                if( status[value] === option[value]) return;
                const target = status as Record<string, unknown>;
                const sets = {
                    [value]: option[ value ]
                } as Record<string, unknown>;
                Object.assign(target, sets);
            });
            if( !status.authenticated && newAuthorization ) service.publishAuthenticated();

        },
        withHandler(handlers) {
            includesHandlers( status.handlers, handlers )
        },

        createEventual(  entry ){
            return CreateEventualEntry( service, entry );
        },

        updateEventual(  entry ) {
            return  UpdateEventualEntry( service, entry );
        },
        removeEventual(  entry ) {
            return  RemoveEventualEntry( service, entry );
        },
        createEventualFormOrchestration(result) {
            return CreateEventualEntryFromNodeOrchestration(service, result );
        },

        deliveryEntries( keys: string[]) {
            return DeliveryPendentEntriesService<ID,AUTH>( service, keys )
        },

        executeOrchestration( node) {
            if( isOrchestrationNode( node ) ){
                return ExecuteOrchestrationService( service, node );
            } else if( isOrchestrationNodeResponse( node ) ){
                return ExecuteOrchestrationEventually( service, node);
            }
            throw new Error( "Node is not OrchestrationNode or OrchestrationNodeResponse",  );
        },

        async registry(registry, resolver) {
            return await Registry.registry(registry, resolver);
        },
        eventualDeliveryFromRegistry(registry: string) {
            return EventualDeliveryOrchestrationFromRegistry( service, registry );
        },
        async getOrchestrationRootRegistry(identifier, args ) {
            const reg = Registry.registries[identifier];
            return ResolveOrchestrationRoot( reg, args );
        }
    }

    const service = init as ApolloVaultService<ID, AUTH>;
    return service;
}