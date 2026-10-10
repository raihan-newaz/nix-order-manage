import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Scope the initial lint gate to the new builder; legacy code has no prior lint baseline.
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'test-results/**', 'playwright-report/**'] },
  { files: ['server/src/modules/builder/**/*.ts', 'client/src/builder/**/*.{ts,tsx}', 'server/src/scripts/installBuilder.ts'], extends: [js.configs.recommended, ...tseslint.configs.recommended], languageOptions: { globals: { window: 'readonly', document: 'readonly', console: 'readonly', process: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', structuredClone: 'readonly', URL: 'readonly', Blob: 'readonly', File: 'readonly', KeyboardEvent: 'readonly' } }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], '@typescript-eslint/no-explicit-any': 'error' } }
);
