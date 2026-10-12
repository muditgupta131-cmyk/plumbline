import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Deliberately narrow: rules that catch real defects, not formatting opinions. Type checking is
// already enforced by `npm run typecheck`, so this exists to find the things tsc cannot see —
// notably stale hook dependencies and hooks called conditionally.
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'server/scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['client/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['server/src/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      // An unused name prefixed with _ is an intentional placeholder.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
    },
  },
);
