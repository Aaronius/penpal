# Contributing to Penpal

Thanks for contributing to Penpal.

## Development Setup

1. Install dependencies:
   - `npm install`
2. Run tests:
   - `npm test`

## Testing Overview

Penpal uses Vitest Browser Mode with Playwright for browser-based tests.

- Browser suites live in `test/**/*.spec.ts`.
- File-protocol tests live in `test/fileProtocol` and are run via `scripts/testFileProtocol.js`.
- Type tests live in `test/types` and run via `tsc --noEmit`.

By default, `npm test` runs Chromium coverage (`test:chromium`), which includes both:

- the main browser suite
- the file-protocol test

Additional browser runs:

- `npm run test:firefox`
- `npm run test:webkit`
- `npm run test:edge` (requires Microsoft Edge installed locally)

To run the full browser matrix:

- `npm run test:all-browsers`

## NPM Scripts

All scripts below are defined in `package.json`.

- `npm run build`
  - Builds ESM, CJS, and IIFE bundles, then builds a minified IIFE bundle.
- `npm run build:analysis`
  - Prints minified bundle size analysis for `dist/penpal.min.js`.
- `npm run lint`
  - Runs ESLint with autofix and cache enabled.
- `npm run format`
  - Runs Prettier on JSON, TS, JS, CJS, Markdown, and HTML files.
- `npm test`
  - Alias for `npm run test:chromium`.
- `npm run test:watch`
  - Alias for `npm run test:watch:chromium`.
- `npm run prepublishOnly`
  - Runs formatting, linting, Chromium tests, type tests, and build before publish.
- `npm run prepare`
  - Installs Husky git hooks.
- `npm run test:watch:chromium`
  - Runs Vitest Browser Mode in watch mode using Chromium.
- `npm run test:chromium:browser`
  - Runs the main browser test suite in Chromium.
- `npm run test:firefox:browser`
  - Runs the main browser test suite in Firefox.
- `npm run test:edge:browser`
  - Runs the main browser test suite in Edge channel via Playwright.
- `npm run test:webkit:browser`
  - Runs the main browser test suite in WebKit.
- `npm run test:file`
  - Runs file-protocol tests using the browser selected by `BROWSER`.
- `npm run test:file:chromium`
  - Runs file-protocol tests in Chromium.
- `npm run test:file:firefox`
  - Runs file-protocol tests in Firefox.
- `npm run test:file:edge`
  - Runs file-protocol tests in Edge.
- `npm run test:file:webkit`
  - Runs file-protocol tests in WebKit.
- `npm run test:chromium`
  - Runs Chromium browser suite and Chromium file-protocol tests.
- `npm run test:firefox`
  - Runs Firefox browser suite and Firefox file-protocol tests.
- `npm run test:edge`
  - Runs Edge browser suite and Edge file-protocol tests.
- `npm run test:webkit`
  - Runs WebKit browser suite and WebKit file-protocol tests.
- `npm run test:all-browsers`
  - Runs Chromium, Firefox, Edge, and WebKit full test commands.
- `npm run test:types`
  - Runs TypeScript type tests with `tsconfig.typesTest.json`.
- `npm run test:legacy:vendor -- <6.x.x-version>`
  - Downloads and vendors a Penpal 6 build used by backward-compatibility fixtures.
