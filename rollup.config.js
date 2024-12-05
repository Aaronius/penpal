const babel = require('@rollup/plugin-babel');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: 'src/indexForBundle.ts',
  output: {
    file: 'dist/penpal.js',
    format: 'iife',
    indent: '  ',
    name: 'Penpal',
  },
  plugins: [
    typescript({
      compilerOptions: {
        outDir: 'dist',
        declaration: false,
      },
    }),
    babel({
      extensions: ['.ts'],
      babelHelpers: 'bundled',
    }),
  ],
};
