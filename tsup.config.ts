// tsup.config.ts
import { defineConfig } from 'tsup'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

export default defineConfig({
    entry: ['src/index.ts'],

    format: ['cjs', 'esm'],
    target: 'es2022',
    platform: 'browser',
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,

    esbuildPlugins: [
        NodeGlobalsPolyfillPlugin({ process: true, buffer: true }),
        NodeModulesPolyfillPlugin(),
    ],

    esbuildOptions(options) {
        options.jsx = 'automatic'
        options.loader = { '.ts': 'ts', '.tsx': 'tsx' }
        options.alias = {
            path: 'path-browserify',
            crypto: 'crypto-browserify',
            stream: 'stream-browserify',
            util: 'util',
            buffer: 'buffer',
            process: 'process/browser',
        }
    },

    external: ['@apollo/client', 'graphql', 'react', 'react-dom', 'localforage'],
})