import {EventPublish, EventSubscritor, SubscriptionChannels} from "../types";

export function CreateSubscriptionChannels<
    ED extends { [k in keyof ED]: ED[k] extends ((...args: infer P) => unknown) ? ED[k] : never }
>():SubscriptionChannels<ED> {
    type EventsHandler = ED[keyof ED];

    const subscriptions = new Proxy({} as Record<keyof ED, Set<EventsHandler>>, {
        get(target, p )  {
            const key = p as keyof typeof target;
            let handler = target[ key ];
            if (!handler) {
                // Inicializa o Set com o tipo de função EventHandler
                handler = target[key] = new Set<EventsHandler>();
            }
            return handler;
        }
    }) as Record<keyof ED, Set<ED[keyof ED]>>;


    const sub:EventSubscritor<ED> = {
        subscribe<E extends keyof ED>( event:E, handler:ED[E] ) {
            subscriptions[event].add( handler )
            return ()=>{
                subscriptions[event].delete( handler );
            }
        },
        once<E extends keyof ED>( event:E, handler:ED[E] ) {
            const execute = ((...args: unknown[] )=>{
                unsub();
                return (handler as CallableFunction)( ...args );
            }) as ED[E];

            subscriptions[event].add( execute );
            const unsub = ()=>{
                subscriptions[event].delete( execute );
            }
            return unsub;
        }
    }

    const pub:EventPublish<ED> = {
        async publishOneByOne<E extends keyof ED>( event:E, ...args: ( ED[E] extends ((...args: infer P) => unknown) ? P : never ) ) {
            const handlers = subscriptions[event].values();
            for (const handler of handlers) {
                await Promise.resolve((handler as CallableFunction)( ...(args)));
            }
        },
        publish<E extends keyof ED>( event:E, ...args: ( ED[E] extends ((...args: infer P) => unknown) ? P : never)  ) {
            const handlers = subscriptions[event].values();
            for (const handler of handlers) {
                (handler as CallableFunction)(...(args as unknown[]))
            }
        }
    };

    return { sub, subscriptions, pub}
}