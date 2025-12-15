import {ApolloVaultService, EventualDeliveryTask, OfflineMutationQueueResponse} from "../types";
import {GraphQLError} from "graphql/index";

function GQLErros( error:unknown ){
    if( Array.isArray( error ) ) return error as GraphQLError[];
    const err = new GraphQLError((error as Error).message);
    Object.assign(err, { trigger:  err });
    return [err];

}

export async function DeliveryPendentEntriesService <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>(service:ApolloVaultService<ID,AUTH>, keys:string[]):Promise<OfflineMutationQueueResponse<ID,AUTH>> {
    if (!keys?.length) return {
        result:false,
        message: "Nenhum registro para ser sincronizado!",
        level: "info"
    };

    const status = await service.status.isHealthy();
    if ( !status ) return {
        result:false,
        message: "Impossível iniciar a sincronização, servidor encontra-se indisponivel para proceder as sincronização!",
        level: "warning"
    };


    const delivery = (op: EventualDeliveryTask<ID, AUTH>): Promise<{status?:typeof op["status"], response?:unknown, errors?:readonly GraphQLError[]}> => {
        return new Promise( async ( resolve) => {
            if (op.OrchestrationNodeResponse) {
                const process = await service.executeOrchestration( op.OrchestrationNodeResponse );

                if( process.ExistsEventualDeliveryTask ){
                    op.OrchestrationNodeResponse = process;
                    return resolve({status: "eventual", response: process });
                }

                if( !!process.errors?.length && !! op.eventualRetry && op.eventualRetry > 0 ) return resolve({ status: "eventual", response: process, errors: process.errors });
                if( !!process.errors?.length ) return resolve({  status: "failed", response: process, errors: process.errors });
                return resolve({  status: "ok", response: process });
            }



            if( !service.client ) return resolve({ status: "eventual" });
            if( op.status !== "eventual" ) return resolve({});
            service.client.mutate<EventualDeliveryTask<ID,AUTH>>({
                mutation: op.query,
                variables: op.variables,
                context: op.context,
            }).then( (result) => {


                if( !!result.error && !! op.eventualRetry && op.eventualRetry > 0 ) return resolve({ ...op, status: "eventual", response: result, errors: GQLErros(result.error) });
                if( !!result.error ){
                    return resolve({ status: "failed", response: result, errors: GQLErros(result.error) });
                }
                return resolve({  status: "ok", response: result });
            }).catch( (err) => {
                if(  !!op.eventualRetry && op.eventualRetry > 0 ) return resolve({ ...op, status: "eventual", response: undefined, errors: GQLErros( err )});
                return resolve({ ...op, status: "failed", response: undefined, errors: err });
            });
        })
    }

    const success:EventualDeliveryTask<ID,AUTH>[] = [];
    const failed:EventualDeliveryTask<ID,AUTH>[] = [];
    const eventual:EventualDeliveryTask<ID,AUTH>[] = [];

    for (const key of keys ) {
        const next = await service.ApolloEventualDelivery.getItem<EventualDeliveryTask<ID,AUTH>>(key);

        if( !next) {
            await service.ApolloEventualDelivery.removeItem(key);
            continue;
        }

        const session  = next.UseIdentity as keyof typeof service.status.identity;

        if( next?.identity?.[session] !== service.status.identity?.[session] ){
            console.warn( `[EventualDelivery] Authorization changed after created eventual delivery mutation. Skipping...` );
            eventual.push(next);
            continue;
        }
        try {
            const res  = await delivery(next);
            if( res.status === "ok" ){
                await service.removeEventual( next );
                success.push(next);
            } else if( res.status === "eventual" ){
                await service.updateEventual( next );
                eventual.push(next);
            } else if ( res.status === "failed" ) {
                failed.push(next);
            } else {
                await service.removeEventual( next );
            }
            console.log(`[DelayedMutation] Executed: ${next.mutationName}`);
        } catch (err) {
            console.error(`[DelayedMutation] Failed to execute ${next.mutationName}:`, err);
        }
    }

    return {
        result: !failed.length,
        level: failed.length? "error"
            : eventual.length? "warning"
                : "success",
        message: failed.length? `Houve error ao sincronizar entradas offiline! Falhas: ${failed.length} | Eventual: ${eventual.length} | Sucesso: ${success.length}`
            : eventual.length? `Uma ou mais entradas offline serão sincronizada posteriormente!  Eventual: ${eventual.length} | Sucesso: ${success.length}`
                : `Todas as ${success.length} entradas offline foram sincronizada com sucesso!`,
        success,
        failed,
        eventual
    }
}
