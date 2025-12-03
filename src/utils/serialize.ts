// filename: src/libs/apollo-vault/utils/serialize.ts

// 🔹 Serializa um objeto ordenando chaves recursivamente
export function serializeObject<T>(obj: T): unknown {
    if (obj === null || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
        return obj.map(serializeObject)
    }
    const keys = Object.keys(obj).sort();
    const pairs:{[p:string]:unknown} = {};
    keys.forEach((key:string) => {
        pairs[key] = obj[key as keyof typeof obj];
    })
    return pairs
}