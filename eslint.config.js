import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import';

const ECMA_VERSION = 2022;

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'import/extensions': [
        'error',
        'always',
        {
          js: 'always',
          ts: 'always',
          json: 'always',
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'lib/', 'cjs/'],
  },
  {
    files: ['*.cjs'],
    languageOptions: {
      globals: globals.commonjs,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['test/types-test/**/*'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['scripts/**/*', 'karma.conf.cjs'],
    languageOptions: {
      ecmaVersion: ECMA_VERSION,
      globals: globals.node,
    },
  },
  // See https://www.npmjs.com/package/eslint-plugin-unused-imports
  {
    plugins: {
      'unused-imports': unusedImports,
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  }
);
