import {nanoid} from "nanoid";
import {
    ApolloVaultService,
    EventualDeliveryTask,
    OrchestrationNodeResponse
} from "../types";
import {DocumentNode} from "@apollo/client";
import {GraphQLError} from "graphql/index";
import {isOrchestrationNodeResponse} from "../utils/typeof";

export async function RemoveEventualEntry<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( service:ApolloVaultService<ID,AUTH>, entry:EventualDeliveryTask<ID,AUTH> ):Promise<{entry?: EventualDeliveryTask<ID, AUTH> | undefined, error?: GraphQLError}>{
    return new Promise( resolve => {
        service.ApolloEventualDelivery.removeItem( entry.identifier! ).then(() => {
            resolve({ entry });
        }).catch((saveError) => {
            resolve({ error: saveError });
        });
    });
}
export async function RemoveEventualEntryByID<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( service:ApolloVaultService<ID,AUTH>, identifier:string ):Promise<{entry?: EventualDeliveryTask<ID, AUTH> | undefined, error?: GraphQLError}> {
    const entry =(await service.ApolloEventualDelivery.getItem<EventualDeliveryTask<ID,AUTH>>( identifier ))!;
    return new Promise( resolve => {
        service.ApolloEventualDelivery.removeItem( identifier ).then(() => {
            resolve({ entry });
        }).catch((saveError) => {
            resolve({ error: saveError });
        });
    });
}

export async function UpdateEventualEntry<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( service:ApolloVaultService<ID,AUTH>, entry:EventualDeliveryTask<ID,AUTH> ){
    if( entry.OrchestrationNodeResponse )
        entry.OrchestrationNodeResponse = cleanOrchestrationResponse(entry.OrchestrationNodeResponse);
    return CreateEventualEntry( service , entry );
}

export function CreateEventualEntry<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>(  service:ApolloVaultService<ID,AUTH>, entry:EventualDeliveryTask<ID,AUTH> ): Promise<{entry?: EventualDeliveryTask<ID, AUTH> | undefined, error?: GraphQLError}>{
    let identifier = entry.identifier;
    const instant = Date.now();
    if( !identifier ){
        const next = service.status.entries ++;
        identifier =  `${instant}-${next}-${nanoid(8)}`;
        entry.identifier = identifier;
    }

    if( !entry.instant ){
        entry.instant = new Date().toISOString();
    }

    if( !entry.identity ) entry.identity = service.status.identity;
    return new Promise( resolve => {
        service.ApolloEventualDelivery.setItem( identifier, entry ).then(() => {
            resolve({ entry });
        }).catch((saveError) => {
            console.error( "ErrorAoCriarEventualDelivery", saveError, entry );
            resolve({ error: saveError });
        });
    });
}

export async function CreateEventualEntryFromNodeOrchestration<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( service:ApolloVaultService<ID,AUTH>, result:OrchestrationNodeResponse ):Promise<{entry?: EventualDeliveryTask<ID, AUTH> | undefined, error?: GraphQLError}>{
    const node = result.node;
    if( !node ) return { error: new GraphQLError( "Invalid node result")};
    const vars = result.status?.variables;
    const { EventualDelivery, ...context } = result?.status?.context??{};

    if( !EventualDelivery ) return { error: new GraphQLError( "Orchestration is not EventualDelivery")};


    const entry:EventualDeliveryTask<ID,AUTH> = {
        mutationName: node?.name ?? "OrchestrationMutation",
        instant: new Date().toISOString(),
        query: result.operation as DocumentNode,
        variables: vars,
        tags: EventualDelivery.tags,
        context: context,
        eventualRetry: EventualDelivery?.retry || 10,
        EventualDelivery: EventualDelivery,
        status: "eventual",
        UseIdentity: context.UseIdentity,
        OrchestrationNodeResponse: cleanOrchestrationResponse(result),  // Armazena árvore parcial
        OrchestrationPendents: Object.keys(node.linked || {}),  // Pendentes
    };

    return CreateEventualEntry( service ,entry);
}


/**
 * Remove recursivamente as propriedades 'node' e 'parent' de um objeto
 * OrchestrationNodeResponse e todos os seus nós filhos em 'linked'.
 * Isso é crucial para que o objeto possa ser serializado (clonado) pelo IndexedDB,
 * evitando problemas de referências circulares ou funções em 'node'.
 * * @param result O objeto OrchestrationNodeResponse a ser limpo.
 * @returns Uma nova instância de OrchestrationNodeResponse limpa.
 */
function cleanOrchestrationResponse(
    result: OrchestrationNodeResponse
): OrchestrationNodeResponse {
    const cleanBaseResult = { ... result};
    const linked = cleanBaseResult.linked;
    delete cleanBaseResult.node;
    delete cleanBaseResult.parent;
    delete cleanBaseResult.linked;


    // Se não houver nós ligados, devolvemos o objeto base limpo
    if (!linked) {
        return cleanBaseResult as OrchestrationNodeResponse;
    }

    // 2. Processamento recursivo dos nós ligados ('linked')
    const cleanedLinked: Record<string, OrchestrationNodeResponse | OrchestrationNodeResponse[]> = {};

    for (const key in linked) {
        const item = linked[key];

        if (Array.isArray(item)) {
            // Se for um Array, mapeia e limpa cada item
            cleanedLinked[key] = item.map(cleanOrchestrationResponse);
        } else {
            // Se for um único nó, limpa-o diretamente
            cleanedLinked[key] = cleanOrchestrationResponse(item);
        }
    }

    return {
        ...cleanBaseResult,
        linked: cleanedLinked
    } as OrchestrationNodeResponse;
}

export async function EventualDeliveryOrchestrationFromRegistry<
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( service:ApolloVaultService<ID,AUTH>, registry:string ){
    const keys = await service.ApolloEventualDelivery.keys();
    return (await Promise.all(keys.map( async value => {
        const entry = await service.ApolloEventualDelivery.getItem<EventualDeliveryTask<ID,AUTH>>( value );
        if( entry?.OrchestrationNodeResponse?.registry !== registry ) return null;
        if( !isOrchestrationNodeResponse(entry?.OrchestrationNodeResponse) ) return null;
        return value;
    }))).filter( value => !!value )
        .map( ( value ) => value as string)
    ;
}