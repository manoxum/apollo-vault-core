// filename: src/libs/apollo-vault/errors/network.ts

import {GraphQLError} from "graphql/index";
import {ErrorLike} from "@apollo/client";

export type ApolloVaultErrorCode = number
    | "NETWORK_ERROR_DEFAULT"
    | "UNKNOWN_NETWORK_ERROR"
    | "CONNECTION_FAILED"
;
export class ApolloVaultError extends GraphQLError {
    statusCode: ApolloVaultErrorCode
    networkErrorType?:string
    body?: string
    response?:  Response
    by?:Error|ErrorLike|GraphQLError
    eventual?:boolean
    constructor(message:string, code:ApolloVaultErrorCode) {
        super(message);
        this.statusCode = code;
    }
}