// filename: src/libs/apollo-vault/link/delivery.ts


// =====================================================
// 🔹 CreateEventualRequestLink
import {ApolloLink, Observable} from "@apollo/client";
import {ExecutionResult} from "graphql/execution";
import {GraphQLError} from "graphql/index";
import {
    EventualDeliveryResponse,
    EventualDeliveryTask,
    ApolloVaultService,
} from "../types";


export function CreateMutationEventualDeliveryLink<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>(service:ApolloVaultService<ID, AUTH>) {
    return new ApolloLink((operation, forward) => {
        const { EventualDelivery: ED, UseIdentity, ...context } = operation.getContext()??{};

        const mutationName = operation.operationName || "UnnamedMutation";

        const isMutation = operation.query.definitions.some(
            def => def.kind === "OperationDefinition" && def.operation === "mutation"
        );

        if ( !isMutation || !ED || ED?.BYPASS ) {
            return forward(operation);
        }

        operation.setContext({
            ...context,
            fetchPolicy: "no-cache"
        });

        return new Observable<ExecutionResult>( (observer) => {
            const subscription = (async ()=>{
                const health = (await service.status.isHealthy());
                let EventualDelivery = ED;
                if( !!ED && typeof ED !== "object" ) EventualDelivery = {};

                const eventualResponse = (opts:{delivery:string,message:string, entry?:EventualDeliveryTask<ID,AUTH>}, errors?:(GraphQLError)[]) =>{
                    const EventualDeliveryResponse:EventualDeliveryResponse<ID,AUTH> = {
                        ...opts.entry,
                        EventualDelivery,
                    }

                    observer.next({
                        ...(errors && errors.length? {errors}: {}),
                        extensions: {
                            ...opts,
                            EventualDeliveryResponse
                        }
                    });
                    observer.complete();
                }

                const createEventual = ( errors?:GraphQLError[] )=>{
                    EventualDelivery.retry = EventualDelivery?.retry || 10;

                    ["authorization", "Authorization", "AUTHORIZATION"].forEach( (value) => {
                        if( !!context?.headers?.[value] ) delete context?.headers?.[value];
                    });

                    service.createEventual({
                        mutationName,
                        query: operation.query,
                        variables: operation.variables,
                        context: context,
                        eventualRetry: EventualDelivery?.retry || 10,
                        EventualDelivery,
                        status: "eventual",
                        UseIdentity: UseIdentity,
                        identity: service.status?.identity
                    }).then( value => {
                        const entry = value.entry;
                        if( !!value.error ){
                            eventualResponse({
                                entry: entry,
                                delivery: "failed",
                                message: `Eventual delivery register for operation '${mutationName}' failed!`,
                            }, [...errors??[], value.error]);
                            return;
                        }
                        eventualResponse({
                            entry,
                            delivery: "eventual",
                            message: `Eventual delivery register for operation '${mutationName}' successfully!`,
                        });
                    });
                }

                if (!!EventualDelivery && (!health || EventualDelivery.eventual === "always")) {
                    createEventual();
                    return;
                }

                // Requisição ao servidor
                return forward(operation).subscribe({
                    next: async (result) => {
                        const error = result.errors;
                        if( error?.length && (EventualDelivery.eventual === "error" || EventualDelivery.eventual === "on-first-error")){
                            return createEventual(error as GraphQLError[]);
                        }
                        observer.next({
                            ...(result as ExecutionResult),
                            extensions: {
                                ...(result?.extensions ?? {}),
                                eventual: false,
                                delivery: "immediately",
                                message: `Mutation '${mutationName}' executada instantaneamente!`,
                                EventualDelivery
                            }
                        });
                        observer.complete();
                    },
                    error: (err) => {
                        if( EventualDelivery.eventual === "error" || EventualDelivery.eventual === "on-first-error" )
                            return createEventual([err])
                        observer.error(err);
                        observer.complete();
                    },
                });
            })();

            return () => {
                subscription.then( sub => sub?.unsubscribe?.())
            };
        });
    });
}
