import { defineConfig } from 'tsup';

export default defineConfig(({ clean, minify }) => {
  return {
    entry: { penpal: 'src/index.ts' },
    clean: clean === undefined || clean,
    treeshake: true,
    outDir: 'dist',
    sourcemap: true,
    globalName: 'Penpal',
    outExtension({ format }) {
      let outputExtension;

      if (format === 'iife') {
        if (minify) {
          outputExtension = '.min.js';
        } else {
          outputExtension = '.js';
        }
      } else if (format === 'cjs') {
        outputExtension = '.cjs';
      } else if (format === 'esm') {
        outputExtension = '.mjs';
      } else {
        outputExtension = `.${format}.js`;
      }

      return {
        js: outputExtension,
      };
    },
  };
});
