// filename: src/libs/apollo-vault/link/orchestration.ts


import {ApolloLink, Observable} from "@apollo/client";
import {ObjMap} from "graphql/jsutils/ObjMap";
import {OrchestrationResponseParse} from "../utils/orchestration-response-parse";
import {ApolloVaultService} from "../types";


export function CreateOrchestrationLink<ID extends Record<string, unknown>, AUTH extends Record<string, unknown>>(
    service: ApolloVaultService<ID, AUTH>
) {

    return new ApolloLink((operation, forward) => {
        return new Observable((observer) => {
            (async () => {
                const context = operation.getContext();
                const { OrchestrationNode } = context;
                if (!OrchestrationNode || OrchestrationNode?.BYPASS )
                    return forward(operation).subscribe(observer);

                try {
                    // Executa a operação raiz
                    OrchestrationNode.name = operation.operationName;
                    const response = await service.executeOrchestration( OrchestrationNode );
                    const extensions = response.extensions??{};


                    if( response.ExistsEventualDeliveryTask ){
                        const saved = await service.createEventualFormOrchestration( response );
                        extensions.EventualDeliveryResponse = {
                            ...saved.entry,
                        };
                    }

                    extensions.OrchestrationResponse = {
                        response: response,
                        parsed: OrchestrationResponseParse( response, {} )
                    };

                    observer.next({
                        data: response.data as ObjMap<unknown> | null | undefined ,
                        extensions: {
                            ...extensions,
                        },
                    });
                    observer.complete();
                } catch (err) {
                    observer.error(err);
                }
            })();
        });
    });
}



export type ParseOptions = {
    s?: string[];
};
