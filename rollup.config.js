import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/indexForBundle.ts',
  output: {
    file: 'dist/penpal.js',
    format: 'iife',
    indent: '  ',
    name: 'Penpal',
  },
  plugins: [
    typescript({
      tsconfig: 'src/tsconfig.json',
      compilerOptions: {
        outDir: 'dist',
        declaration: false,
        module: 'esnext',
        moduleResolution: 'bundler',
      },
    }),
  ],
};
