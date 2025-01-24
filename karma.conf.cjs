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
      {
        pattern: 'test/childFixtures/**',
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
    proxies: {
      '/penpal.js': '/base/dist/penpal.js',
      '/pages': '/base/test/childFixtures/pages',
      '/workers': '/base/test/childFixtures/workers'
    },
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
