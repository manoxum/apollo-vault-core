// filename: src/libs/apollo-vault/utils/sha.ts

// =====================================================
// 🔹 Funções utilitárias de hashing (SHA-256)
import {createHash} from "crypto";

export function generateSha256Hash(content:unknown | undefined) {
    const hash = createHash('sha256');
    const str = String(content);
    hash.update(
        content === null? `null::`
            : content === undefined ? `undefined::`
                : !str?.length? `void::`
                    : `text::${str}`
    );
    return hash.digest('hex');
}
export function sha256Truncated (input: unknown | undefined, length: number): string {
    const hash = generateSha256Hash(input).toString();
    return hash.slice(0, length);
}



// 🔹 Função de hash determinístico
export function createHashFromObject(obj: unknown, length?: number): string {
    const json = JSON.stringify( obj );
    const hash = generateSha256Hash(json);
    return length ? hash.slice(0, length) : hash;
}
