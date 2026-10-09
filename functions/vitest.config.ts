import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'functions',
    environment: 'node',
    testTimeout: 60_000,
  },
});
