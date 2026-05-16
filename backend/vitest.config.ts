import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src')
        }
    },
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./src/__tests__/helpers/setup.ts'],
        globalSetup: ['./src/__tests__/helpers/global-setup.ts'],
        testTimeout: 60000,
        hookTimeout: 60000,
        fileParallelism: false,
        pool: 'forks'
    }
});
