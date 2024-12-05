#!/usr/bin/env node
'use strict';

const path = require('path');
const http = require('http');
const connect = require('connect');
const karma = require('karma');
const serveStatic = require('serve-static');
const argv = require('yargs').argv;
const rollup = require('rollup');
const config = require('../rollup.config');

const serveChildViews = () => {
  // We'll run the child iframe on a different port from karma to
  // to properly test cross-domain iframe communication
  const childViewsApp = connect()
    .use(serveStatic('dist'))
    .use(serveStatic('test/childFixtures'));

  http.createServer(childViewsApp).listen(9000);
  // Host the child views on two ports so tests can do interesting
  // things like redirect the iframe between two origins.
  http.createServer(childViewsApp).listen(9001);
};

const runTests = async () => {
  const karmaConfig = await karma.config.parseConfig(
    path.resolve(__dirname, '../karma.conf.js'),
    { singleRun: !argv.watch }
  );
  const karmaServer = new karma.Server(karmaConfig);
  await karmaServer.start();
};

const build = () => {
  const watcher = rollup.watch(config);

  let testsRunning = false;

  watcher.on('event', (event) => {
    // Wait until the first bundle is created before
    // running tests.
    switch (event.code) {
      case 'END':
        if (!testsRunning) {
          void runTests();
          testsRunning = true;
        }

        if (!argv.watch) {
          watcher.close();
        }
        break;
      case 'ERROR':
      case 'FATAL':
        console.error(event.error);
        break;
    }
  });
};

serveChildViews();
build();
