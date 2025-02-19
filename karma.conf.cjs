const typescript = require('@rollup/plugin-typescript');

module.exports = (config) => {
  config.set({
    browsers: [
      'Chrome',
      // 'Firefox',
      // 'Edge',
      // 'Safari'
    ],
    files: [
      {
        pattern: 'test/childFixtures/{pages,workers}/**',
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
      '/workers': '/base/test/childFixtures/workers',
      // This specific path is very important. Due to browser security, the
      // service worker file must be loaded from the root directory in order for
      // the service worker to be able to control the page the tests are
      // running in. Learn more by looking up "service worker scope".
      '/serviceWorker.js': '/base/test/childFixtures/workers/serviceWorker.js',
    },
    proxyValidateSSL: false,
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
    frameworks: ['jasmine'],
    colors: true,
    logLevel: config.LOG_INFO,
    // logLevel: config.LOG_DEBUG,
    autoWatch: true,
    reporters: ['dots'],
    singleRun: false,
    concurrency: Infinity,
  });
};
