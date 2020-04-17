const babel = require('rollup-plugin-babel');
const typescript = require('rollup-plugin-typescript');

module.exports = {
  input: 'src/indexForBundle.ts',
  output: [
    {
      file: 'dist/penpal.js',
      format: 'iife',
      name: 'Penpal'
    }
  ],
  plugins: [
    typescript(),
    babel({
      extensions: ['.ts']
    })
  ]
};
