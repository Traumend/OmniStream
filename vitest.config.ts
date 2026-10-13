import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/core', 'packages/platforms', 'functions', 'apps/web'],
  },
});
