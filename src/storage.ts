// filename: src/libs/apollo-vault/storage.ts


import datasource from "localforage";

export function OpenStorages( SCHEMA_VERSION: number = 1 ) {
    const SCHEMA_VERSION_KEY = "ApolloCached:version";
    const ApolloMetadata = datasource.createInstance({
        name: "ApolloStorage",
        size: 1024 * 1024 * 2,
        description: "Apollo Query Operation Cached",
        storeName: "Metadata"
    });
    const ApolloQueryCached =  datasource.createInstance({
        name: "ApolloStorage",
        version: SCHEMA_VERSION,
        size: 1024 * 1024 * 500,
        description: "Apollo Query Operation Cached",
        storeName: "Cache"
    });
    const  OfflineData =datasource.createInstance({
        name: "ApolloStorage",
        version: SCHEMA_VERSION,
        size: 1024 * 1024 * 2,
        description: "Apollo Query Operation Cached",
        storeName: "OfflineData"
    });
    const ApolloEventualDelivery =  datasource.createInstance({
        name: "ApolloStorage",
        version: 1,
        size: 1024 * 1024 * 50,
        description: "Apollo Mutation Operation Eventual Delivery",
        storeName: "EventualDelivery"
    });
    const ApolloEventualDeliverySolved =  datasource.createInstance({
        name: "ApolloStorage",
        version: 1,
        size: 1024 * 1024 * 50,
        description: "Apollo Mutation Operation Eventual Delivery Solved",
        storeName: "Delivered"
    });

    const ready = new Promise<boolean>( async resolve => {
        const currentVersion = await ApolloMetadata.getItem(SCHEMA_VERSION_KEY);
        if (currentVersion !== SCHEMA_VERSION) {
            console.warn(`[ApolloClient] Versão do schema mudou (${currentVersion} → ${SCHEMA_VERSION}), limpando cache...`);
            await ApolloQueryCached.clear();
            console.log("[CacheControl] Cache limpo com sucesso");
            await ApolloMetadata.setItem(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
        }
        return resolve(true);
    });

    return {
        ready,
        storages: {
            ApolloEventualDelivery,
            ApolloEventualDeliverySolved,
            ApolloQueryCached,
            OfflineData,
        }
    }
}