const babel = require('rollup-plugin-babel');
const typescript = require('rollup-plugin-typescript');
const argv = require('yargs').argv;

module.exports = (config) => {
  // Example set of browsers to run on Sauce Labs
  // Check out https://saucelabs.com/platforms for all browser/platform combos
  var customLaunchers = {
    sl_edge: {
      base: 'SauceLabs',
      browserName: 'microsoftedge',
      platform: 'Windows 10',
      version: 'latest',
    },
    sl_chrome: {
      base: 'SauceLabs',
      browserName: 'chrome',
      platform: 'Windows 10',
      version: 'latest',
    },
    sl_firefox: {
      base: 'SauceLabs',
      browserName: 'firefox',
      platform: 'Windows 10',
      version: 'latest',
    },
    sl_mac_safari: {
      base: 'SauceLabs',
      browserName: 'safari',
      platform: 'OS X 10.11',
      version: 'latest',
    },
    sl_mac_chrome: {
      base: 'SauceLabs',
      browserName: 'chrome',
      platform: 'OS X 10.11',
      version: 'latest',
    },
    sl_mac_firefox: {
      base: 'SauceLabs',
      browserName: 'firefox',
      platform: 'OS X 10.11',
      version: 'latest',
    },
    sl_android: {
      base: 'SauceLabs',
      deviceName: 'Android GoogleAPI Emulator',
      appiumVersion: '1.13.0',
      browserName: 'Chrome',
      platformName: 'Android',
      platformVersion: '7.1',
    },
    sl_ios: {
      base: 'SauceLabs',
      deviceName: 'iPhone 8 Simulator',
      appiumVersion: '1.9.1',
      browserName: 'Safari',
      platformName: 'iOS',
      platformVersion: '11.0',
    },
  };

  var browsers = ['Chrome'];
  var reporters = ['dots'];
  var startConnect = true;

  if (argv.sauce) {
    browsers = Object.keys(customLaunchers);
    reporters = ['dots', 'saucelabs'];

    if (process.env.TRAVIS) {
      // ios and android testing from Travis doesn't work half the time. :/
      browsers.splice(browsers.indexOf('sl_ios'), 1);
      startConnect = false;
    }
  }

  config.set({
    frameworks: ['jasmine'],
    files: [
      {
        pattern: 'test/childFixtures/worker.ts',
        watched: true,
        included: false,
        served: true,
      },
      'dist/penpal.js',
      'test/**/*.spec.ts',
    ],
    plugins: [
      '@metahub/karma-rollup-preprocessor',
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-babel-preprocessor',
      'karma-sauce-launcher',
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
        // To compile with babel using es2015 preset
        plugins: [
          typescript(),
          babel({
            extensions: ['.ts'],
          }),
        ],
      },
    },
    port: 9001,
    colors: true,
    logLevel: config.LOG_INFO,
    // logLevel: config.LOG_DEBUG,
    autoWatch: true,
    sauceLabs: {
      testName: 'Penpal Karma Test',
      tunnelIdentifier: process.env.TRAVIS_JOB_NUMBER,
      startConnect: startConnect,
    },
    customLaunchers: customLaunchers,
    browsers: browsers,
    reporters: reporters,
    singleRun: false,
    concurrency: Infinity,
    // Travis + SauceLabs is super flaky. This attempts to solve the issue:
    // https://github.com/jasmine/jasmine/issues/1327#issuecomment-332939551
    // browserDisconnectTolerance: 2,
    // browserNoActivityTimeout: 1000000,
    // browserNoActivityTimeout: 50000,
    // customHeaders: [{
    //   match: "worker.ts",
    //   name: "Access-Control-Allow-Origin",
    //   value: "*"
    // }]
  });
};
