import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'apps/web/**',
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      'pruebas/**/.fixtures/**',
      '.superpowers/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
