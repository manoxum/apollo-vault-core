// filename: src/libs/apollo-vault/link/interceptor.ts

import { ApolloLink, Observable } from "@apollo/client";
import {ApolloVaultError, ApolloVaultErrorCode} from "../errors/network";

export function CreateNetworkErrorInterceptorLink(): ApolloLink {
    return new ApolloLink((operation, forward) => {
        return new Observable(observer => {
            const sub = forward(operation).subscribe({
                next: (response) => {
                    observer.next(response)
                },
                error: (error) => {
                    if( error instanceof ApolloVaultError ) return observer.error(error);

                    // **Lógica de determinação do statusCode ATUALIZADA**
                    const httpError = error as { statusCode?: number; response?: Response, body?:string };
                    let statusCode: ApolloVaultErrorCode = 'NETWORK_ERROR_DEFAULT';
                    let errorMessage = error.message;

                    // Prioriza o statusCode injetado pelo FetchLink customizado
                    if (httpError.statusCode) {
                        statusCode = httpError.statusCode;
                    }

                    // Tenta pegar o status de erros HttpLink/FetchLink que podem ter a resposta
                    else if (httpError.response?.status) {
                        statusCode = httpError.response.status;
                    }

                    // Falha de Conexão Pura
                    else if (error instanceof TypeError && error.message === 'Failed to fetch') {
                        statusCode = 'CONNECTION_FAILED'; // Unificamos o código
                        errorMessage = 'Network connection failed';
                    }

                    // Outros erros de rede (DNS, etc.)
                    else if (error.name === 'Error') {
                        statusCode = 'UNKNOWN_NETWORK_ERROR';
                        errorMessage = 'Unknown network error';
                    }

                    const ve = new ApolloVaultError( errorMessage, statusCode );
                    ve.by = error;
                    ve.networkErrorType = error.name;
                    observer.error( ve );
                    return;
                },
                complete: () => observer.complete(),
            });

            return () => sub.unsubscribe();
        });
    });
}