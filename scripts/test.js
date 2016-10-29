#!/usr/bin/env node
'use strict';

const path = require('path');
const http = require('http');
const connect = require('connect');
const KarmaServer = require('karma').Server;
const serveStatic = require('serve-static');
const argv = require('yargs').argv;

// We'll run the child iframe on a different port from karma to
// to properly test cross-domain iframe communication
const childIframeApp = connect()
  .use(serveStatic(path.join(__dirname, '../node_modules/rsvp/dist')))
  .use(serveStatic('dist'))
  .use(serveStatic('test/fixtures'));

http.createServer(childIframeApp).listen(9000);

new KarmaServer({
  configFile: path.resolve(__dirname, '../karma.conf.js'),
  singleRun: !argv.watch
}).start();
