module.exports = function(config) {
  config.set({
    port: 9001,
    frameworks: ['jasmine'],
    browsers: ['Chrome', 'Firefox'],
    files: [
      require.resolve('rsvp/dist/rsvp.min.js'),
      'dist/penpal.js',
      'test/index.js',
    ],
    plugins: [
      'karma-jasmine',
      'karma-chrome-launcher',
      'karma-firefox-launcher',
      'karma-babel-preprocessor'
    ],
    preprocessors: {
      'test/**/*.js': ['babel']
    }
  });
};
