import {ApolloVaultService, EventualDeliveryTask, OfflineMutationQueueResponse} from "../types";

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


    const delivery = (op: EventualDeliveryTask<ID, AUTH>): Promise<EventualDeliveryTask<ID, AUTH>> => {
        return new Promise( async ( resolve) => {
            if (op.OrchestrationNodeResponse) {
                const process = await service.executeOrchestration( op.OrchestrationNodeResponse );
                if( process.ExistsEventualDeliveryTask ) return resolve({ ...op, status: "eventual", response: process });
                if( !!process.errors?.length && !! op.eventualRetry && op.eventualRetry > 0 ) return resolve({ ...op, status: "eventual", response: process, errors: process.errors });
                if( !!process.errors?.length ) return resolve({ ...op, status: "failed", response: process, errors: process.errors });
                return resolve({ ...op, status: "ok", response: process });
            }

            if( !service.client ) return resolve(op);
            if( op.status !== "eventual" ) return resolve(op);
            service.client.mutate<EventualDeliveryTask<ID,AUTH>>({
                mutation: op.query,
                variables: op.variables,
                context: op.context,
            }).then( (result) => {
                if( !!result.error && !! op.eventualRetry && op.eventualRetry > 0 ) return resolve({ ...op, status: "eventual", response: result, errors: result.error});
                if( !!result.error ) return resolve({ ...op, status: "failed", response: result, errors: result.error });
                return resolve({ ...op, status: "ok", response: result });
            }).catch( (err) => {
                console.log(err);
                if(  !!op.eventualRetry && op.eventualRetry > 0 ) return resolve({ ...op, status: "eventual", response: undefined, errors: err});
                return resolve({ ...op, status: "failed", response: undefined, errors: err });
            });
        })
    }

    const success:EventualDeliveryTask<ID,AUTH>[] = [];
    const failed:EventualDeliveryTask<ID,AUTH>[] = [];
    const eventual:EventualDeliveryTask<ID,AUTH>[] = [];

    for (const key of keys ) {
        let next = await service.ApolloEventualDelivery.getItem<EventualDeliveryTask<ID,AUTH>>(key);

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
            next = await delivery(next);
            if( next.status === "ok" ){
                await service.ApolloEventualDelivery.removeItem(key);
                //TODO não deve ser necessario mais isso... alem de que para funcionar o objecto precisa ser pimpo novamente removendo funções e referencias ciclicas
                // await service.ApolloEventualDeliverySolved.setItem(key, next);
                success.push(next);
            } else if ( next.status === "failed" )failed.push(next);
            else if( next.status === "eventual" ) eventual.push(next);

            console.log(`[DelayedMutation] Executed: ${next.mutationName}`);
        } catch (err) {
            console.error(`[DelayedMutation] Failed to execute ${next.mutationName}:`, err);
        }
    }

    return {
        result:false,
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
