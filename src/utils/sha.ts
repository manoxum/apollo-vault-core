// filename: src/libs/apollo-vault/utils/sha.ts

// =====================================================
// 🔹 Funções utilitárias de hashing (SHA-256)
import {createHash} from "crypto";
import {Path, SerializeObjectOptions} from "../types";



// =====================================================
// 🔹 Funções Padrão de Ordenação (Default Implementations)
// =====================================================

// Default para chaves de objeto: Ordena alfabeticamente.
const defaultOrderKeys = (kys: string[]): string[] => kys.sort();

// Default para arrays: Cria uma cópia e ordena os elementos pelo valor (via conversão para string).
const defaultOrderList = (arr: unknown[]): unknown[] => [...arr].sort();


// =====================================================
// 🔹 Função Auxiliar: checkPathExclusion
// =====================================================
/** Verifica se o path atual está contido na lista de exclusão. */
function isPathExcluded(currentPath: Path, excludes: Path[]): boolean {
    if (!excludes || excludes.length === 0) return false;

    // Converte o path atual em string para comparação mais fácil
    const currentPathStr = currentPath.join('.');

    return excludes.some(excludedPath => {
        // Converte o path de exclusão em string para comparação
        const excludedPathStr = excludedPath.join('.');

        // Verifica se o caminho atual é exatamente igual ou começa com o caminho de exclusão.
        // Isso permite excluir um objeto/array inteiro excluindo apenas o caminho raiz.
        return currentPathStr === excludedPathStr || currentPathStr.startsWith(`${excludedPathStr}.`);
    });
}


// =====================================================
// 🔹 Função: serializeObject
// =====================================================
export function serializeObject<T>(obj: T, opts?:SerializeObjectOptions, ...path:Path): unknown {
    if (obj === null || typeof obj !== 'object') return obj;

    // Verifica a exclusão do objeto/array inteiro no path atual
    if (opts?.excludes && isPathExcluded(path, opts.excludes)) {
        return undefined; // Retorna undefined para efetivamente remover este nó da serialização.
    }

    // Lógica para Arrays
    if (Array.isArray(obj)) {
        let arr:unknown[] = obj as unknown[];

        if( typeof opts?.orderList === "function" ) {
            arr = opts.orderList( obj, path ); // Callback customizado
        }
        else if (opts?.orderList === 'default') {
            arr = defaultOrderList( obj as unknown[] ); // Ordenação padrão por valor
        }
        // Se for 'none' ou undefined, a ordem original é mantida.

        // Mapeia e filtra elementos filhos excluídos
        const serializedArray = arr.map( (value, index) => {
            return serializeObject( value, opts, ...path, index )
        }).filter(value => value !== undefined); // Remove os elementos que foram excluídos/serializados como undefined

        return serializedArray;
    }

    // Lógica para Objetos
    let keys :string[];
    const objKeys = Object.keys(obj);

    if( typeof opts?.orderKeys === "function" ) {
        keys = opts.orderKeys(objKeys, path); // Callback customizado
    }
    else if (opts?.orderKeys === 'default') {
        keys = defaultOrderKeys(objKeys); // Ordenação alfabética padrão
    }
    else if (opts?.orderKeys === 'none') {
        keys = objKeys; // Nenhuma ordenação (pode não ser determinístico!)
    }
    else {
        // Fallback: Se não for definido, assume 'default'
        keys = defaultOrderKeys(objKeys);
    }

    const pairs:{[p:string]:unknown} = {};
    keys.forEach((key:string) => {
        const childPath = [...path, key];

        // 🛑 Implementação da Exclusão por Chave/Caminho
        if (opts?.excludes && isPathExcluded(childPath, opts.excludes)) {
            // Ignora a chave/valor se o caminho for encontrado na lista de exclusão
            return;
        }

        // Serializa o valor do filho e armazena se não for undefined (por exclusão recursiva)
        const serializedValue = serializeObject(obj[key as keyof typeof obj], opts, ...childPath);
        if (serializedValue !== undefined) {
            pairs[key] = serializedValue;
        }
    })
    return pairs
}

// =====================================================
// 🔹 Função: generateSha256Hash
// =====================================================
export function generateSha256Hash(content:unknown | undefined, trunc?: number): string {
    const hash = createHash('sha256');
    // ... (lógica de prefixação de tipo permanece a mesma)
    const str = content === null? `null::`
        : content === undefined ? `undefined::`
        : typeof content === "string" && !content.length? `void::`
        : typeof content === "number" ? `number::${String(content)}`
        : typeof content === "boolean" ? `boolean::${String(content)}`
        : typeof content === "function" ? `function::${content.toString()}`
        : typeof content === "symbol" ? `symbol::${content.toString()}`
        : typeof content === "bigint" ? `bigint::${content.toString()}`
        : content instanceof Date ? `Date::${content.toISOString()}`
        : typeof content === "object" ? `object::${JSON.stringify(content)}`
        : `unknown::${JSON.stringify(content)}`;

    hash.update( str );
    const resolved = hash.digest('hex');
    if( trunc??0 >0 ) return  resolved.slice(0, trunc);
    else return resolved;
}

// =====================================================
// 🔹 Função de hash determinístico
// =====================================================
export function deterministicSha256(obj: unknown, opts?:SerializeObjectOptions, trunc?:number) {
    const serialized = serializeObject(obj, opts);
    const hash =  generateSha256Hash( serialized, trunc );
    return { hash, serialized }
}

if( typeof window !== 'undefined' ) {
    Object.assign( window, {
        generateSha256Hash,
        deterministicSha256
    })
}