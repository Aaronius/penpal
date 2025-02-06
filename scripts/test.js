#!/usr/bin/env node

import { createServer } from 'http';
import connect from 'connect';
import karma from 'karma';
import serveStatic from 'serve-static';
import * as rollup from 'rollup';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../rollup.config.js';

const args = process.argv.slice(2); // Exclude `node` and script path
const isWatchMode = args.includes('--watch');

const ports = [9000, 9001];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serveChildViews = () => {
  const app = connect()
    .use(serveStatic('dist'))
    .use(serveStatic('test/childFixtures'))
    .use('/never-respond', () => {
      // Intentionally never respond
    });

  for (const port of ports) {
    createServer(app).listen(port);
  }
};

const runTests = async () => {
  const karmaConfig = await karma.config.parseConfig(
    path.resolve(__dirname, '../karma.conf.cjs'),
    {
      singleRun: !isWatchMode,
    }
  );
  await new karma.Server(karmaConfig).start();
};

const build = () => {
  const watcher = rollup.watch(config);
  let testsRunning = false;

  watcher.on('event', ({ code, error }) => {
    if (code === 'END' && !testsRunning) {
      runTests().catch(console.error);
      testsRunning = true;
      if (!isWatchMode) watcher.close();
    } else if (code === 'ERROR' || code === 'FATAL') {
      console.error(error);
    }
  });
};

serveChildViews();
build();
