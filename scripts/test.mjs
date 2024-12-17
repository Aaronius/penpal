#!/usr/bin/env node
'use strict';

import { fileURLToPath } from 'url';
import path from 'path';
import { createServer } from 'http';
import connect from 'connect';
import karma from 'karma';
import serveStatic from 'serve-static';
import * as rollup from 'rollup';
import config from '../rollup.config.mjs';

// Resolve __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI arguments from `process.argv`
const args = process.argv.slice(2); // Exclude `node` and script path
const isWatchMode = args.includes('--watch');

// Serve static child views
const serveChildViews = () => {
  const childViewsApp = connect()
    .use(serveStatic('dist'))
    .use(serveStatic('test/childFixtures'));

  // Host child views on two ports for cross-domain iframe tests
  [9000, 9001].forEach((port) => createServer(childViewsApp).listen(port));
};

// Run tests using Karma
const runTests = async () => {
  const { parseConfig } = karma.config;
  const karmaConfigPath = path.resolve(__dirname, '../karma.conf.cjs');
  const karmaConfig = await parseConfig(karmaConfigPath, {
    singleRun: !isWatchMode,
  });
  await new karma.Server(karmaConfig).start();
};

// Build project and watch for changes
const build = () => {
  const watcher = rollup.watch(config);
  let testsRunning = false;

  watcher.on('event', ({ code, error }) => {
    if (code === 'END' && !testsRunning) {
      runTests().catch(console.error); // Log test errors
      testsRunning = true;
      if (!isWatchMode) watcher.close();
    } else if (code === 'ERROR' || code === 'FATAL') {
      console.error(error);
    }
  });
};

// Start services
serveChildViews();
build();
