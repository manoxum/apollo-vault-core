# Apollo Vault

[![npm version](https://img.shields.io/npm/v/@apollo-vault/core.svg?style=flat-square)](https://www.npmjs.com/package/@apollo-vault/core)
[![npm downloads](https://img.shields.io/npm/dm/@apollo-vault/core.svg?style=flat-square)](https://www.npmjs.com/package/@apollo-vault/core)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@apollo-vault/core.svg?style=flat-square)](https://bundlephobia.com/package/@apollo-vault/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/manoxum/apollo-vault-core?style=social)](https://github.com/manoxum/apollo-vault-core/stargazers)

# Apollo Vault Core

**Apollo Client 100% offline-first** com entrega eventual de mutações, orquestração de operações, cache persistido (IndexedDB), sincronização inteligente e suporte completo a autenticação/refreshes.

Ideal para:
- Next.js 14/15 (app router & pages router)
- React Native / Expo
- PWAs
- Aplicações com rede instável
- Sistemas críticos onde **nenhum dado pode ser perdido**

## Instalação

```bash
npm install @apollo-vault/core @apollo/client graphql localforage nanoid
# ou
yarn add @apollo-vault/core @apollo/client graphql localforage nanoid
# ou
pnpm add @apollo-vault/core @apollo/client graphql localforage nanoid
**Apollo Vault** is an advanced extension for [Apollo Client](https://www.apollographql.com/docs/react/) designed to enhance GraphQL applications with offline support, eventual consistency for mutations, query orchestration, intelligent caching, authentication handling, and synchronization mechanisms. It is particularly suited for applications requiring resilience in unstable network conditions, such as mobile or web apps with offline capabilities.

Key capabilities include:
- **Eventual Delivery**: Queue mutations for automatic retry when the network recovers.
- **Orchestration Trees**: Compose and execute hierarchical GraphQL operations (queries/mutations) in parallel or sequentially, with support for breakers, subscriptions, and linked nodes.
- **Caching with Policies**: Configurable TTL, health checks, and cache control for queries.
- **Authentication Integration**: Automatic retries on unauthenticated errors, token refresh timers, and event listeners.
- **Offline Synchronization**: Manage and sync offline data/mutations via customizable groups and engines.
- **Incremental Queries**: Stream partial results for large datasets.
- **Custom Apollo Links**: Chainable links for transport, auth, caching, binary parsing, monitoring, orchestration, and eventual delivery.
- **Event Pub/Sub**: Subscribe to events like 'unauthenticated', 'healthy', or orchestration lifecycle events.
- **Secure Utilities**: SHA-256 hashing for deterministic keys and serialization.

Apollo Vault integrates seamlessly with React hooks, Apollo Client, and external services like authentication providers, health checkers, and notifiers.

## Features

- **Offline Mutation Handling**: Store and retry mutations using LocalForage-backed queues.
- **Orchestration Registry**: Register and execute complex operation trees with dynamic resolvers.
- **Synchronization Engine**: Group-based syncing for offline data, with progress tracking and abort controls.
- **Auth Refresh Service**: Timer-based and event-driven token refreshes, integrated with Vault events.
- **Health-Aware Operations**: Skip or queue operations based on network health.
- **React Hooks Integration**: Easy access via `useApolloVault`, `useOrchestration`, `useIncrementalQuery`, etc.
- **Type-Safe Generics**: Supports custom identity (`ID`) and authorization (`AUTH`) types.
- **Debug Utilities**: Print orchestration trees, hash objects for keys, and serialize data.

## Installation

```bash
npm install apollo-vault @apollo/client graphql localforage nanoid crypto
```

Or with Yarn:

```bash
yarn add apollo-vault @apollo/client graphql localforage nanoid crypto
```

**Dependencies**:
- `@apollo/client`: Core GraphQL client.
- `graphql`: GraphQL utilities.
- `localforage`: Persistent storage for offline data.
- `nanoid`: Unique ID generation.
- `crypto`: Hashing (Node.js built-in; polyfill for browsers).
- Optional: `react`, `moment`, `uuid` for advanced usage.

## Quick Start

### 1. Create the Vault Instance

```typescript
import { CreateApolloVault } from 'apollo-vault';

const vault = CreateApolloVault<Partial<AuthIdentity>, Partial<Authorization>>(1, { // SCHEMA_VERSION
  transport: { uri: '/graphql', credentials: 'include' },
  handlers: {
    isHealthy: async () => navigator.onLine, // Custom health check
    notifier: (message, level) => console.log(`[${level}] ${message}`),
    requestAuthentication: () => { /* Trigger auth flow */ },
  },
  healthPolicyTTL: 30000, // 30s TTL for health
  UseIdentity: 'token_uid', // Identity key for auth
  WaitAuthentication: { timeout: 5000, attempts: 3 }, // Auth retry config
});
```

### 2. Provide the Vault in React

Use `ApolloVaultProvider` to make the vault available:

```tsx
import { ApolloVaultProvider } from 'apollo-vault';
import { ApolloVaultController } from './path/to/provider'; // Custom wrapper if needed

function App() {
  return (
    <ApolloVaultController>
      {/* Your app components */}
    </ApolloVaultController>
  );
}
```

In a custom provider (e.g., `provider.tsx`):

```tsx
export function ApolloVaultController({ children }) {
  // Use hooks for env, snackbar, health
  // Update vault with transport, handlers, etc.
  return (
    <ApolloVaultProvider vault={vault}>
      {children}
    </ApolloVaultProvider>
  );
}
```

## Configuration

`CreateApolloVaultOptions<ID, AUTH>`:
- `transport`: `HttpLink` options (e.g., `uri`, `credentials`).
- `handlers`: Custom functions for health checks (`isHealthy`), notifications (`notifier`), and auth requests.
- `healthPolicyTTL`: Cache duration for health status (ms).
- `UseIdentity`: Key for identity in auth headers.
- `WaitAuthentication`: Config for auth retry (timeout, attempts).
- `auth`: Initial authorization context.

Update vault dynamically with `vault.update({ ... })`.

## Usage Examples

### Authentication Integration

Integrate with auth providers for token refresh and event handling.

In `AuthenticationProvider.tsx`:

```tsx
import { AuthenticationProvider } from './path/to/AuthenticationProvider';

function App() {
  return (
    <AuthenticationProvider>
      {/* App content */}
    </AuthenticationProvider>
  );
}
```

Hooks like `useAuthRefresh` listen to Vault's 'unauthenticated' event:

```typescript
useEffect(() => {
  const unsub = vault.subscribe('unauthenticated', async() => {
      await {Authorization} = YourImplementedRefreshTokenHandler();
      storeAuthorization({Authorization});
  });
  return unsub;
}, [vault]);
```



### Orchestration Setup and Execution

Define and register orchestration trees for complex operations, e.g., creating inspections with attachments.

In `orchestration.ts`:

```typescript
import { orchestrate, registry } from 'apollo-vault';

const { root, fn, node } = orchestrate<{ /* Inputs */ }>();

const OPERATION_ROOT = gql`/*Your GraphQL Query or Mutation Definition*/`
const OPERATION_CHILD = gql`/*Your GraphQL Query or Mutation Definition*/`
const OPERATION_CHILD2 = gql`/*Your GraphQL Query or Mutation Definition*/`

INSPECTION_PAGE_URL = import.meta.url;
export const YOUR_ORCHESTRATION_REGISTRY = registry(INDEX_URL, INSPECTION_PAGE_URL, 'INSPECTION_ORCHESTRATION');
export const YOUR_ORCHESTRATION = root({
  registry: ORCHESTRATION_NAME_REGISTRY,
  operation: OPERATION_ROOT,
  variables: (initials) => initials?.variables,
  context: (initial) => ({
    EventualDelivery: { eventual: 'always', message: 'Bind attach...', retry: 10 },
  }),
  linked: {
    ChildOperation: fn((initials) => {
      return initials?.FilesUploads?.map(file => node({
        operation: OPERATION_CHILD,
        variables: { /* file details */ },
          linked: {
            ChildChildOperation: node({
                operation: OPERATION_CHILD2,
                variables:()=> ({/*Resolvable Variables*/})
            })
          }
      })) ?? [];
    }),
  },
  subscription: (listener) => {
    listener.subscribe('started', (node) => printOrchestrationTree(node));
    listener.subscribe('finalized', (response) => printOrchestrationTree(response));
  },
});
```

Register in a hook:

```typescript
import { useRegistryOrchestrationService } from './useRegistryOrchestration';

useRegistryOrchestrationService(); // Registers INSPECTION_ORCHESTRATION
```

Execute with `useOrchestration`:

```tsx
const { execute, data, error, executing } = useOrchestration(YOUR_ORCHESTRATION_REGISTRY, YOUR_ORCHESTRATION);
execute({ variables: { /* inputs */ } });
```

### Form and Mutation Handling

Use in forms with offline support, e.g., `useSetsInspection.ts`:

```typescript
const { submit } = useSetsInspection(/* options */);

submit(async (values) => {
  const response = await execute({
    SetsInspections: { data: {/* form data */} },
    FilesUploads: files,
  });
  // Handle response
});
```

### Offline Synchronization

Use `SynchronizeProvider` for managing offline sync groups, like mutations.

In `SynchronizeProvider.tsx`:

```tsx
import { SynchronizeProvider } from './SynchronizeProvider';

function App() {
  return (
    <SynchronizeProvider>
      {/* App content */}
    </SynchronizeProvider>
  );
}
```

Define groups, e.g., `MutationSyncGroup.ts`:

```typescript
export async function syncronizePendentMutation() {
    const keys = await apolloVaultInstance.ApolloEventualDelivery.keys();
    const response = await apolloVaultInstance.deliveryEntries( keys );
}
```

Trigger sync with `useSynchronize`:

```typescript
const { synchronize } = useSynchronize();
synchronize(); // Runs engine with groups
```

The `SynchronizerEngine` processes groups, tracking progress and handling aborts.

## API Reference

### Core

- `CreateApolloVault<ID, AUTH>(schemaVersion, options)`: Creates vault instance.
- `vault.update(fields)`: Update configurable fields (e.g., transport, handlers).
- `vault.executeOrchestration(resolver, args)`: Run orchestration tree.
- `vault.registry(registry, resolver)`: Register orchestration.
- `vault.deliveryEntries(keys)`: Process queued mutations.
- `vault.subscribe(event, handler)`: Listen to events (e.g., 'unauthenticated').
- `vault.publishResponse({ operation, response })`: Broadcast results.

### Hooks

- `useApolloVault<ID, AUTH>()`: Access vault.
- `useOrchestration(registry, resolver)`: Execute registered orchestration.
- `useIncrementalQuery(query, options)`: Stream query results.
- `useSynchronize()`: Trigger and monitor sync.

### Utils

- `orchestrate<Inputs>()`: Build orchestration trees (`root`, `node`, `fn`).
- `registry(baseUrl, metaUrl, name)`: Generate registry key.
- `printOrchestrationTree(node)`: Debug tree structure.
- `generateSha256Hash(content)`: Hash for keys.
- `serializeObject(obj)`: Safe serialization.

## Contributing

Fork, branch, commit, push, PR. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).