var argv = require('yargs').argv;

module.exports = function(config) {
  // Example set of browsers to run on Sauce Labs
  // Check out https://saucelabs.com/platforms for all browser/platform combos
  var customLaunchers = {
    sl_ie11: {
      base: 'SauceLabs',
      browserName: 'internet explorer',
      platform: 'Windows 10',
      version: '11'
    },
    sl_edge: {
      base: 'SauceLabs',
      browserName: 'microsoftedge',
      platform: 'Windows 10',
      version: 'latest'
    },
    sl_chrome: {
      base: 'SauceLabs',
      browserName: 'chrome',
      platform: 'Windows 10',
      version: 'latest'
    },
    sl_firefox: {
      base: 'SauceLabs',
      browserName: 'firefox',
      platform: 'Windows 10',
      version: 'latest'
    },
    sl_mac_safari: {
      base: 'SauceLabs',
      browserName: 'safari',
      platform: 'OS X 10.11',
      version: 'latest'
    },
    sl_mac_chrome: {
      base: 'SauceLabs',
      browserName: 'chrome',
      platform: 'OS X 10.11',
      version: 'latest'
    },
    sl_mac_firefox: {
      base: 'SauceLabs',
      browserName: 'firefox',
      platform: 'OS X 10.11',
      version: 'latest'
    },
    sl_ios: {
      base: 'SauceLabs',
      browserName: 'iphone',
      version: '9.3',
      platform: 'macOS 10.12',
    },
    sl_android: {
      base: 'SauceLabs',
      browserName: 'chrome',
      appiumVersion: '1.6.3',
      platformVersion: '7.0',
      platformName: 'Android',
      deviceName: 'Android GoogleAPI Emulator'
    }
  };

  var browsers = argv.sauce ? Object.keys(customLaunchers) : ['Chrome', 'Firefox'];

  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],


    // list of files / patterns to load in the browser
    files: [
      require.resolve('rsvp/dist/rsvp.min.js'),
      'dist/penpal.js',
      'test/index.js',
    ],


    // list of files to exclude
    exclude: [
    ],

    plugins: [
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-babel-preprocessor',
      'karma-sauce-launcher'
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'test/**/*.js': ['babel']
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['progress'],


    // web server port
    port: 9001,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    sauceLabs: {
      testName: 'Penpal Karma Test',
      tunnelIdentifier: process.env.TRAVIS_JOB_NUMBER,
      startConnect: false
    },

    customLaunchers: customLaunchers,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: browsers,

    reporters: ['dots', 'saucelabs'],

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,
  })
};
