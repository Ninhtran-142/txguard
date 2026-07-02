// Flat ESLint config (ESLint v9+) for TxGuard.
// Replaces the legacy .eslintrc.cjs which is incompatible with ESLint v10.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'dev/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      // Browser + extension globals. TypeScript already flags undefined
      // identifiers, so `no-undef` is disabled to avoid duplicate noise.
      globals: {
        chrome: 'readonly',
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        crypto: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        MessageEvent: 'readonly',
        URL: 'readonly',
        Date: 'readonly',
        Math: 'readonly',
        Error: 'readonly',
        Number: 'readonly',
        String: 'readonly',
        BigInt: 'readonly',
        Boolean: 'readonly',
        Promise: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        JSON: 'readonly',
        Map: 'readonly',
        Set: 'readonly',
        globalThis: 'writable',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
