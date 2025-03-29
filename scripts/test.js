#!/usr/bin/env node

import { createServer } from 'http';
import connect from 'connect';
import karma from 'karma';
import serveStatic from 'serve-static';
import path from 'path';
import { fileURLToPath } from 'url';
import { build } from 'tsup';

const args = process.argv.slice(2); // Exclude `node` and script path
const isWatchMode = args.includes('--watch');

const ports = [9000, 9001];
const servers = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startServer = async (app, port) => {
  return new Promise((resolve, reject) => {
    const server = createServer(app);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `Port ${port} is already in use. Please free up this port and try again.`
        );
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(port, () => {
      console.log(`Server started on port ${port}`);
      resolve(server);
    });
  });
};

const serveChildViews = async () => {
  const app = connect()
    .use(serveStatic('dist'))
    .use(serveStatic('test/childFixtures'))
    .use('/never-respond', () => {
      // Intentionally never respond
    });

  try {
    for (const port of ports) {
      const server = await startServer(app, port);
      servers.push(server);
    }
  } catch (err) {
    console.error('Failed to start servers:', err);
    process.exit(1);
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

const buildPenpal = async () => {
  const watcher = await build({
    watch: isWatchMode,
    config: true,
    format: 'iife',
  });

  if (watcher) {
    watcher.on('success', () => {
      runTests().catch(console.error);
    });
  } else {
    await runTests();
  }
};

process.on('exit', () => {
  servers.forEach((server) => server.close());
});

serveChildViews();
buildPenpal();
