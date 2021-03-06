// Karma configuration
// Generated on Wed Jan 15 2014 11:11:25 GMT+1100 (EST)

module.exports = function(config) {
  config.set({

    // base path, that will be used to resolve files and exclude
    basePath: '../..',

    // frameworks to use
    frameworks: ['jasmine', 'requirejs'],

    // list of files / patterns to load in the browser
    files: [
      'atlas-cesium/test/test-main.js',
      {pattern: 'atlas/assets/**/*', included: false},
      {pattern: 'atlas/src/**/*.js', included: false},
      {pattern: 'atlas/lib/**/*.js', included: false},
      {pattern: 'atlas-cesium/src/**/*.js', included: false},
      {pattern: 'atlas-cesium/lib/**/*.js', included: false},
      {pattern: 'atlas-cesium/lib/**/*.png', included: false},
      {pattern: 'atlas-cesium/test/specs/**/*Spec.js', included: false},
      {pattern: 'atlas-cesium/test/util/**/*.js', included: false}
      // {pattern: 'atlas-cesium/lib/cesium/Source/**/*.js', included: false}
    ],

    // list of files to exclude
    exclude: [
      // 'atlas-cesium/lib/cesium/**/*',
      'atlas-cesium/lib/cesium/Apps/**/*',
      'atlas-cesium/lib/cesium/Build/**/*',
      'atlas-cesium/lib/cesium/Documentation/**/*',
      'atlas-cesium/lib/cesium/launches/**/*',
      'atlas-cesium/lib/cesium/Specs/**/*',
      'atlas-cesium/lib/cesium/ThirdParty/**/*',
      'atlas-cesium/lib/cesium/Tools/**/*',
      // Used locally to keep various other versions of Cesium.
      'atlas-cesium/lib/cesium_*/**/*',
      // 'atlas-cesium/lib/cesium_b25/**/*',
      // 'atlas-cesium/lib/cesium_b27/**/*',
      // 'atlas-cesium/lib/cesium_b30/**/*',
      '../docs/*',
      '../docs/**/*'
    ],

    // Pre-process for code coverage
    preprocessors: {
      'atlas-cesium/src/**/*.js': 'coverage'
    },

    coverageReporter: {
      dir: 'atlas-cesium/coverage/',
      reporters: [
        {type: 'html', subdir: 'report-html'},
        {type: 'lcovonly', subdir: '.', file: 'lcov.dat'}
      ]
    },

    // test results reporter to use
    // possible values: 'dots', 'progress', 'junit', 'gowl', 'coverage'
    reporters: ['progress', 'coverage'],

    // web server port
    port: 9874,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // Start these browsers, currently available:
    // - Chrome
    // - ChromeCanary
    // - Firefox
    // - Opera (has to be installed with `npm install karma-opera-launcher`)
    // - Safari (only Mac; has to be installed with `npm install karma-safari-launcher`)
    // - PhantomJS
    // - IE (only Windows; has to be installed with `npm install karma-ie-launcher`)
    browsers: ['Firefox'],

    // If browser does not capture in given timeout [ms], kill it
    captureTimeout: 60000,

    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: true
  });
};
