import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config({
  extends: [js.configs.recommended, ...tseslint.configs.recommended, prettier],
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
  },
  rules: {
    '@typescript-eslint/explicit-function-return-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.changeset/**'],
});
