import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'screenshots'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  { files: ['e2e/**/*.mjs', 'scripts/**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', location: 'readonly', document: 'readonly', window: 'readonly', navigator: 'readonly', caches: 'readonly', indexedDB: 'readonly', localStorage: 'readonly', URL: 'readonly', Buffer: 'readonly' } } },
);
