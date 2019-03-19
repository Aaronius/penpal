// const babel = require('rollup-plugin-babel');
import babel from 'rollup-plugin-babel';

export default {
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
