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
    ignores: ['dist/', 'lib/', 'cjs/', 'test/childFixtures/vendor/**'],
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
    files: ['test/types/**/*'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: [
      'scripts/**/*',
      'vitest.browser.config.ts',
      'vitest.unit.config.ts',
    ],
    languageOptions: {
      ecmaVersion: ECMA_VERSION,
      globals: globals.node,
    },
    rules: {
      'import/extensions': 'off',
    },
  },
  {
    files: ['test/childFixtures/workers/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.worker,
        ...globals.serviceworker,
        Penpal: 'readonly',
        PenpalGeneralFixtureMethods: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
    },
  },
  {
    files: ['test/childFixtures/shared/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
        ...globals.serviceworker,
      },
    },
  },
  {
    files: ['test/childFixtures/pages/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        Penpal: 'readonly',
        PenpalFixture: 'readonly',
        PenpalGeneralFixtureMethods: 'readonly',
        PenpalLegacyFixture: 'readonly',
      },
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
