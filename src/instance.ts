// filename: src/libs/apollo-vault/instance.ts


import {CreateUnifiedTransportLink} from "./link/transport";
import {CreateAuthorizationLink} from "./link/auth";
import {CreateCacheControlLink} from "./link/cache";
import {CreateMutationEventualDeliveryLink} from "./link/delivery";
import {ApolloClient, ApolloLink, InMemoryCache} from "@apollo/client";
import {Defer20220824Handler} from "@apollo/client/incremental";
import {CreateBinaryParserLink} from "./link/binary";
import {CreateMonitoringLink} from "./link/response";
import {CreateUnauthenticatedLink} from "./link/unauthenticated";
import {CreateOrchestrationLink} from "./link/orchestration";
import {CreateApolloVaultServices} from "./services";
import {ApolloOfflineVault, ApolloVaultService, CreateApolloVaultOptions} from "./types";


export function CreateApolloVault<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( SCHEMA_VERSION: number = 1, opts?:CreateApolloVaultOptions<ID,AUTH> ) {

    const services = CreateApolloVaultServices(SCHEMA_VERSION, opts);

    const orchestrationLink = CreateOrchestrationLink( services);
    const monitoringLink = CreateMonitoringLink( services );
    const cacheLink = CreateCacheControlLink( services );
    const eventualRequestLink = CreateMutationEventualDeliveryLink( services );
    const binaryParserLink = CreateBinaryParserLink( services );
    const authorizedLink = CreateUnauthenticatedLink( services );
    const authorizationLink = CreateAuthorizationLink( services);
    const transportLink = CreateUnifiedTransportLink( services );

    const link = ApolloLink.from([
        monitoringLink,
        orchestrationLink,
        cacheLink,
        eventualRequestLink,
        binaryParserLink,
        authorizedLink,
        authorizationLink,
        transportLink
    ]);

    services.client = new ApolloClient({
        link,
        incrementalHandler: new Defer20220824Handler(),
        cache: new InMemoryCache(),
        defaultOptions: {
            mutate: { fetchPolicy: "no-cache" },
        },
    });

    const offlineVault: ApolloOfflineVault<ID,AUTH> = {
        ...services,
        client: services.client,
    };

    const excludes:(keyof ApolloVaultService<ID,AUTH>)[] = [
        "status", "subscriptions"
    ];
    excludes.forEach( value => {
    delete offlineVault[ value as keyof ApolloOfflineVault<ID,AUTH>]});
    return offlineVault;
}