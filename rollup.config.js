const babel = require('rollup-plugin-babel');

module.exports = {
  input: "src/index.js",
  output: [
    {
      file: "dist/penpal.js",
      format: "iife",
      name: 'Penpal'
    },
    {
      file: "lib/index.js",
      format: "cjs"
    }
  ],
  plugins: [
    babel(),
    // resolve(),
    // commonjs()
  ]
};
