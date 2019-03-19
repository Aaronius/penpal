const babel = require('rollup-plugin-babel');

module.exports = {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/penpal.js',
      format: 'iife',
      name: 'Penpal'
    }
  ],
  plugins: [babel()]
};
