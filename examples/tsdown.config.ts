import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';

const examplesRoot = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = path.resolve(examplesRoot, '..');

export default defineConfig({
  alias: {
    penpal: path.join(repositoryRoot, 'dist/penpal.mjs'),
  },
  clean: true,
  copy: [
    {
      from: 'public/**/*',
      to: 'dist',
      flatten: false,
    },
    {
      from: '../.github/assets/readme-banner-black.png',
      to: 'dist/assets',
      rename: 'penpal-black.png',
    },
    {
      from: '../.github/assets/readme-banner-white.png',
      to: 'dist/assets',
      rename: 'penpal-white.png',
    },
  ],
  cwd: examplesRoot,
  deps: {
    onlyBundle: false,
  },
  dts: false,
  entry: {
    'iframe/child': 'src/iframe/child.ts',
    'iframe/parent': 'src/iframe/parent.ts',
    'opened-window/child': 'src/opened-window/child.ts',
    'opened-window/parent': 'src/opened-window/parent.ts',
    'service-worker/parent': 'src/service-worker/parent.ts',
    'service-worker/service-worker': 'src/service-worker/service-worker.ts',
    'shared-worker/parent': 'src/shared-worker/parent.ts',
    'shared-worker/shared-worker': 'src/shared-worker/shared-worker.ts',
    'worker/parent': 'src/worker/parent.ts',
    'worker/worker': 'src/worker/worker.ts',
  },
  format: 'esm',
  hash: false,
  outDir: 'dist',
  outputOptions(options) {
    return {
      ...options,
      chunkFileNames: 'shared/[name].js',
      entryFileNames: '[name].js',
    };
  },
  platform: 'browser',
  sourcemap: true,
  target: 'es2024',
  tsconfig: 'tsconfig.json',
});
