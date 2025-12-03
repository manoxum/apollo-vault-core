// filename: src/libs/apollo-vault/utils/json-filters.ts

// filename: src/libs/apollo-vault/utils/json-filters.ts

/**
 * Retorna uma função 'replacer' para JSON.stringify que detecta e remove
 * referências circulares, substituindo-as por 'undefined'.
 * * NOTE: O parâmetro 'exclusions' foi removido, pois não é usado internamente.
 * * @returns Uma função replacer que resolve referências circulares.
 */
export function noCicle() { // <-- Parâmetro _exclusions removido
    // WeakSet armazena apenas objetos.
    const seen = new WeakSet<object>();

    return function (_key: string, value: unknown) {
        if (typeof value === "object" && value !== null) {
            // Se o objeto já foi visto no caminho atual, é uma referência circular.
            if (seen.has(value)) {
                return undefined; // Remove a referência circular
            }
            // Marca o objeto como visto no caminho.
            seen.add(value as object);
        }
        return value;
    };
}

// ---

/**
 * Anula (define como null) propriedades de um objeto com base em caminhos de exclusão.
 * Deve ser usada ANTES de chamar JSON.stringify(obj, noCicle(...)) para
 * garantir que os campos excluídos sejam representados como 'null'.
 * * @template T O tipo do objeto de entrada, que será o mesmo do objeto de retorno.
 * @param obj O objeto a ser modificado (uma cópia é feita para não alterar o original).
 * @param exclusions Array de caminhos de exclusão, ex: [['user', 'password'], ['metadata', 'token']].
 * @returns Uma cópia do objeto modificado com os campos de exclusão definidos como 'null'.
 */
export function applyExclusions<T extends object>(obj: T, exclusions: string[][]): T {
    // Cria uma cópia profunda (Deep Copy) do objeto original para não modificá-lo.
    const result = JSON.parse(JSON.stringify(obj)) as T;

    for (const path of exclusions) {
        // 'current' rastreia o nó atual no percurso do caminho.
        let current: object | null | undefined = result;
        const lastKey = path[path.length - 1];
        const pathSegments = path.slice(0, -1);

        // Percorre todos os segmentos do caminho, exceto o último
        for (const segment of pathSegments) {
            // Verifica se o nó atual é um objeto e possui o segmento.
            if (current && typeof current === 'object' && segment in current) {
                // Navega para o próximo nível. O tipo é 'unknown' por segurança.
                current = (current as Record<string, unknown>)[segment] as (object | null | undefined);
            } else {
                // Caminho não encontrado ou interrompido.
                current = undefined;
                break;
            }
        }

        // Se o caminho intermediário foi percorrido com sucesso, anula o valor final.
        if (current && typeof current === 'object' && lastKey in current) {
            // Define a propriedade final como null para exclusão.
            (current as Record<string, unknown>)[lastKey] = null;
        }
    }

    return result;
}