# Contributing to Penpal

Thanks for contributing to Penpal.

## Development Setup

1. Install dependencies:
   - `npm install`
2. Run tests:
   - `npm test`

## Testing Overview

Penpal's test suite includes browser, unit, file-protocol, example smoke, and
type checks.

- Browser suites live in `test/browser/**/*.spec.ts`.
- Unit suites live in `test/unit/**/*.spec.ts`.
- File-protocol tests live in `test/browser/fileProtocol` and are run via `scripts/testFileProtocol.js`.
- Example smoke tests exercise every app in `examples` against a freshly built
  package.
- Type tests live in `test/types` and run via `npm run test:types`.

By default, `npm test` runs unit tests and Chromium coverage, which includes:

- the unit suite
- the main browser suite
- the file-protocol test

Additional browser runs:

- `npm run test:firefox`
- `npm run test:webkit`
- `npm run test:edge` (requires Microsoft Edge installed locally)
- `npm run test:examples` (requires Chromium installed locally)

To run the full browser matrix:

- `npm run test:all-browsers`

## Release Workflow

Penpal releases are prepared explicitly and published by the manual Release
workflow in GitHub Actions. Run version commands from a clean working tree.

### Prepare a Prerelease

Set the first prerelease to an exact version. Increment subsequent prereleases
with npm:

```sh
npm version 8.0.0-next.0 --no-git-tag-version
npm version prerelease --preid=next --no-git-tag-version
```

Use the exact version command only once when starting a prerelease series. Each
later `prerelease` command increments the prerelease number. Replace `8.0.0` with
the intended version when preparing a future major release.

Review and commit the resulting changes to `package.json` and
`package-lock.json`, then push the commit to the release branch matching the
major version, such as `8.x`. Prereleases are published with the `next` npm dist
tag and marked as prereleases on GitHub.

### Prepare a Stable Release

Set the exact stable version without having npm create the release commit or
tag during preparation:

```sh
npm version 8.0.0 --no-git-tag-version
```

Review and commit the resulting changes to `package.json` and
`package-lock.json`. Stable version commits must be merged into `main` before
publishing. Stable releases are published with the `latest` npm dist tag. The
Release workflow creates the Git tag after publication succeeds.

### Publish

Before dispatching the workflow:

- install from the lockfile with `npm ci`
- run `npm run prepublishOnly`
- run the complete browser matrix with `npm run test:all-browsers`
- inspect the package contents with `npm pack --dry-run`
- pack the library to a temporary directory, install that tarball in a fresh
  downstream project, exercise its runtime entry points, and compile
  representative TypeScript usage against its published declarations

Keep smoke-test artifacts outside the repository so the release commit remains
unchanged.

In GitHub, open **Actions**, select **Release**, choose the branch containing the
version commit, and run the workflow. The workflow:

- requires stable versions to be released from `main`
- requires prereleases to be released from the matching major branch, such as
  `8.x`
- runs the complete publication checks before npm accepts the package
- publishes through npm trusted publishing
- creates the version tag and an initial GitHub Release with generated notes

The workflow checks npm and GitHub independently, so it can be rerun safely when
publication or GitHub Release creation succeeded but the other operation failed.

After the workflow succeeds, review and replace the generated GitHub Release
title and description. Use the exact tag, such as `v8.0.0`, as the title. Major
releases use a detailed migration-oriented description covering breaking
changes with **What** and **Why** sections, new features, and bug fixes. Minor,
patch, and prerelease descriptions use a concise list of consumer-facing
changes, with issue, pull request, documentation, and contributor links where
useful.

To publish with Codex, invoke `$penpal-release` and specify the exact version,
for example: `$penpal-release publish Penpal 8.0.0-next.1 from 8.x`. Start from
a clean, up-to-date release branch; do not run the version commands above first.
The skill sets the exact version without creating a local tag, validates the
package, commits and pushes the version files, dispatches and monitors the
workflow, updates the GitHub Release title and description to match Penpal's
historical patterns, and verifies npm and GitHub independently.

## NPM Scripts

All scripts below are defined in `package.json`.

- `npm run build`
  - Builds ESM, CJS, and IIFE bundles, then builds a minified IIFE bundle.
- `npm run build:analysis`
  - Prints minified bundle size analysis for `dist/penpal.min.js`.
- `npm run examples:build`
  - Builds Penpal and all local examples.
- `npm run examples:dev`
  - Builds and serves the local examples at `http://127.0.0.1:4173`.
- `npm run examples:serve`
  - Serves an existing example build without rebuilding it.
- `npm run lint`
  - Runs lint checks and applies safe fixes.
- `npm run lint:check`
  - Runs lint checks without modifying files, suitable for CI.
- `npm run format`
  - Formats JSON, TS, JS, CJS, Markdown, and HTML files.
- `npm run format:check`
  - Checks formatting without modifying files, suitable for CI.
- `npm test`
  - Runs unit tests, then Chromium browser + file-protocol tests.
- `npm run test:watch`
  - Alias for `npm run test:watch:chromium`.
- `npm run prepublishOnly`
  - Runs formatting, lint, Chromium, example, and type checks, then builds the package before publish.
- `npm run prepare`
  - Installs Husky git hooks.
- `npm run test:watch:chromium`
  - Runs the browser test suite in watch mode using Chromium.
- `npm run test:chromium:browser`
  - Runs the main browser test suite in Chromium.
- `npm run test:firefox:browser`
  - Runs the main browser test suite in Firefox.
- `npm run test:edge:browser`
  - Runs the main browser test suite in Edge.
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
- `npm run test:examples`
  - Builds and smoke-tests every local example in Chromium.
- `npm run test:webkit`
  - Runs WebKit browser suite and WebKit file-protocol tests.
- `npm run test:all-browsers`
  - Runs Chromium, Firefox, Edge, and WebKit full test commands.
- `npm run test:unit`
  - Runs fast Node-based unit tests in `test/unit`.
- `npm run test:types`
  - Runs type checks.
- `npm run test:types:examples`
  - Checks the example source against its TypeScript configuration.
