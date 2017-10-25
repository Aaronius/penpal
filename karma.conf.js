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
    sl_android: {
      base: 'SauceLabs',
      deviceName: 'Android GoogleAPI Emulator',
      appiumVersion: '1.7.1',
      browserName: 'Chrome',
      platformName: 'Android',
      platformVersion: '7.1'
    },
    sl_ios: {
      base: 'SauceLabs',
      deviceName: 'iPhone 8 Simulator',
      appiumVersion: '1.7.1',
      browserName: 'Safari',
      platformName: 'iOS',
      platformVersion: '11.0'
    }
  };

  var browsers = ['Chrome', 'Firefox'];
  var reporters = ['dots'];
  var startConnect = true;

  if (argv.sauce) {
    browsers = Object.keys(customLaunchers);
    reporters = ['dots', 'saucelabs'];

    if (process.env.TRAVIS) {
      // ios and android testing from Travis doesn't work half the time. :/
      delete browsers.sl_android;
      delete browsers.sl_ios;
      startConnect = false;
    }
  }

  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    files: [
      require.resolve('rsvp/dist/rsvp.min.js'),
      'dist/penpal.js',
      'test/index.js',
    ],
    plugins: [
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-babel-preprocessor',
      'karma-sauce-launcher'
    ],
    preprocessors: {
      'test/**/*.js': ['babel']
    },
    port: 9001,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    sauceLabs: {
      testName: 'Penpal Karma Test',
      tunnelIdentifier: process.env.TRAVIS_JOB_NUMBER,
      startConnect: startConnect
    },
    customLaunchers: customLaunchers,
    browsers: browsers,
    reporters: reporters,
    singleRun: false,
    concurrency: Infinity,
  })
};
