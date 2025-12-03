// filename: src/libs/apollo-vault/link/binary.ts

import {ApolloLink} from "@apollo/client";
import {ApolloVaultService} from "../types";

function isFile(value: unknown): value is File | Blob {
    return value instanceof File || value instanceof Blob;
}

export function CreateBinaryParserLink <
    ID extends { [k in keyof ID]?:ID[k]},
    AUTH extends { [k in keyof AUTH]?:AUTH[k]}
>( instance:ApolloVaultService<ID,AUTH> ) {
    return new ApolloLink((operation, next ) => {
        const forward = ( )=>{
            return next(operation);
        };
        // Só processa mutations
        const isMutation = operation.query.definitions.some(
            def => def.kind === 'OperationDefinition' && def.operation === 'mutation'
        );
        if (!isMutation) return forward();

        const fileEntries: [string, File | Blob][] = [];

        const walkVariables = (obj: unknown, path: (string|number)[] = []) => {
            if (!obj || typeof obj !== "object") return;

            function append(key: string|number, val:unknown) {
                const currentPath = [...path, key];
                if (isFile(val)) {
                    fileEntries.push([currentPath.join('.'), val as File]);
                    (obj as Record<string, unknown>)[key] = null;
                } else if (Array.isArray(val)) {
                    // val.forEach((item, idx) => walkVariables(item, [...currentPath, idx.toString()]));
                    walkVariables(val, currentPath);
                } else if (typeof val === 'object' && val !== null) {
                    walkVariables(val, currentPath);
                }
            }

            if( Array.isArray( obj) ) obj.forEach( (val, key) => append(key, val))
            else Object.entries(obj).forEach( ([key, val]) => append(key, val))
        };

        const variablesCopy = { ...operation.variables };
        walkVariables(variablesCopy);

        if (fileEntries.length === 0) {
            // Não há arquivos, segue normalmente
            return forward();
        }

        // Monta FormData
        const formData = new FormData();
        formData.append('operations', JSON.stringify({
            query: operation.query.loc?.source.body,
            variables: variablesCopy,
        }));

        const mapObj: Record<string, string[]> = {};
        fileEntries.forEach(([path], idx) => {
            mapObj[idx] = [`variables.${path}`];
        });
        formData.append('map', JSON.stringify(mapObj));

        fileEntries.forEach(([, file], idx) => {
            formData.append(`${idx}`, file);
        });

        // Marca o body no contexto para que HttpLink use
        operation.setContext(( previousContext ) => ({
            ...previousContext??{},
            transport: "http/fetch",
            fetchOptions: {
                ... previousContext.fetchOptions??{},
                body: formData,
            }
        }));
        operation.setContext( previousContext => {
            return previousContext;
        });

        return forward();
    })
}