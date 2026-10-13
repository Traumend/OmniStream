import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integracion',
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    setupFiles: ['./src/configurar.ts'],
  },
});
