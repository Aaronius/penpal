import { defineConfig } from 'tsdown';

export default defineConfig((inlineConfig) => {
  const isMinified = Boolean(inlineConfig.minify);

  return {
    entry: {
      penpal: 'src/index.ts',
    },
    clean: inlineConfig.clean,
    dts: isMinified
      ? false
      : {
          oxc: false,
          resolver: 'tsc',
          sourcemap: true,
        },
    globalName: 'Penpal',
    minify: inlineConfig.minify,
    outDir: 'dist',
    outExtensions({ format }) {
      if (format === 'iife') {
        return {
          js: isMinified ? '.min.js' : '.js',
        };
      }

      if (format === 'cjs') {
        return {
          dts: '.d.cts',
          js: '.cjs',
        };
      }

      if (format === 'es') {
        return {
          dts: '.d.ts',
          js: '.mjs',
        };
      }
    },
    outputOptions(options, format) {
      if (format !== 'iife') {
        return options;
      }

      return {
        ...options,
        entryFileNames: `[name]${isMinified ? '.min' : ''}.js`,
      };
    },
    sourcemap: true,
    target: 'es2024',
    treeshake: true,
  };
});
