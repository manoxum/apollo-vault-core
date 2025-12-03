// filename: src/libs/apollo-vault/updatable.ts

import {InstanceStatus} from "./types";
type Field = keyof InstanceStatus<Record<string, unknown>,Record<string, unknown>>;

function expose<T extends Field>(...fi:T[]){
    return fi;
}

export const UPDATABLE_FIELDS = expose(
    "identity",
    "health",
    "transport",
    "auth",
    "UseIdentity",
    "WaitAuthentication",
    "healthPolicyCheckEveryTime",
    "healthPolicyTTL",
    "handlers",
);