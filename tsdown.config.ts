import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'tsdown';

const stripDeclarationSourceMapComments = () => {
  for (const fileName of readdirSync('dist')) {
    if (!fileName.endsWith('.d.ts') && !fileName.endsWith('.d.cts')) {
      continue;
    }

    const filePath = join('dist', fileName);
    const contents = readFileSync(filePath, 'utf8');
    const strippedContents = contents.replace(
      /\n?\/\/# sourceMappingURL=.*\.d\.(?:c|m)?ts\.map\s*$/,
      '\n',
    );

    if (contents !== strippedContents) {
      writeFileSync(filePath, strippedContents);
    }
  }
};

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
          compilerOptions: {
            declarationMap: false,
          },
          oxc: false,
          resolver: 'tsc',
          sourcemap: false,
        },
    globalName: 'Penpal',
    hooks: {
      'build:done': stripDeclarationSourceMapComments,
    },
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
