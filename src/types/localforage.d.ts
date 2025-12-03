// src/types/localforage.d.ts
import 'localforage'

declare module 'localforage' {
    interface LocalForage {
        getItem<T>(key: string): Promise<T | null>
        setItem<T>(key: string, value: T): Promise<T>
        removeItem(key: string): Promise<void>
        clear(): Promise<void>
        length(): Promise<number>
        keys(): Promise<string[]>
        iterate<T, U>(iteratee: (value: T, key: string, iterationNumber: number) => U): Promise<U>
    }
}

// Declaração global (obrigatória para window.ApolloQueryCached etc.)
interface Window {
    ApolloQueryCached?: LocalForage
    ApolloEventualDelivery?: LocalForage
    ApolloEventualDeliverySolved?: LocalForage
}