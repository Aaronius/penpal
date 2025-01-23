const typescript = require('@rollup/plugin-typescript');

const browsers = [
  'Chrome',
  // 'Firefox',
  // 'Edge',
  // 'Safari'
];
const reporters = ['dots'];

module.exports = (config) => {
  config.set({
    frameworks: ['jasmine'],
    files: [
      // Unlike our HTML fixtures, the worker fixtures must be served from the
      // same host as the tests because the browser only lets a page load
      // workers from the same origin or an opaque origin (null origin).
      {
        pattern: 'test/childFixtures/workers/*.ts',
        watched: true,
        included: false,
        served: true,
      },
      {
        pattern: 'dist/penpal.js',
        watched: true,
        included: false,
        served: true,
      },
      'test/**/*.spec.ts',
    ],
    plugins: [
      '@metahub/karma-rollup-preprocessor',
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-safari-launcher',
      '@chiragrupani/karma-chromium-edge-launcher',
    ],
    preprocessors: {
      'test/**/*.ts': ['rollup'],
    },
    rollupPreprocessor: {
      options: {
        output: {
          // To include inlined sourcemaps as data URIs
          sourcemap: true,
          format: 'iife',
        },
        plugins: [
          typescript({
            // Fail testing if types are wrong.
            noEmitOnError: true,
            include: ['test/**/*', 'src/**/*'],
          }),
        ],
      },
    },
    port: 9003,
    colors: true,
    logLevel: config.LOG_INFO,
    // logLevel: config.LOG_DEBUG,
    autoWatch: true,
    browsers: browsers,
    reporters: reporters,
    singleRun: false,
    concurrency: Infinity,
  });
};
