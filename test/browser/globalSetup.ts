import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import sirv from 'sirv';
import type { RequestHandler } from 'sirv';
import { build } from 'tsup';

const TEST_SERVER_STATE = '__PENPAL_TEST_SERVER_STATE__';
const FIXTURE_PORT = 9000;

type GlobalState = {
  // Track active setup users so we only tear down once the last worker exits.
  refs: number;
  // Deduplicate concurrent setup calls in the same process.
  setupPromise?: Promise<void>;
  fixtureServer?: Server;
  // Only close the server when this process started it.
  ownsFixtureServer: boolean;
};

const startServer = (
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  port: number,
) => {
  return new Promise<Server>((resolve, reject) => {
    const server = createServer(handler);

    server.on('error', (error: NodeJS.ErrnoException) => {
      reject(error);
    });

    server.listen(port, () => resolve(server));
  });
};

const serveInOrder = (
  req: IncomingMessage,
  res: ServerResponse,
  handlers: RequestHandler[],
) => {
  let index = 0;

  const next = () => {
    const handler = handlers[index];
    index += 1;

    if (handler) {
      handler(req, res, next);
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  };

  next();
};

const getGlobalState = (): GlobalState => {
  const globalWithState = globalThis as typeof globalThis & {
    [TEST_SERVER_STATE]?: GlobalState;
  };

  if (!globalWithState[TEST_SERVER_STATE]) {
    // Persist setup state on globalThis so repeated globalSetup executions
    // within the same process can share server instances.
    globalWithState[TEST_SERVER_STATE] = {
      refs: 0,
      ownsFixtureServer: false,
    };
  }

  return globalWithState[TEST_SERVER_STATE]!;
};

export default async function globalSetup() {
  const state = getGlobalState();

  if (!state.setupPromise) {
    state.setupPromise = (async () => {
      // Ensure an up-to-date browser bundle is available before tests run.
      await build({
        config: true,
        format: 'iife',
        clean: false,
      });

      const serveWorkers = sirv('test/browser/fixtures/workers', {
        dev: true,
      });
      const serveDist = sirv('dist', { dev: true });
      const serveFixtures = sirv('test/browser/fixtures', { dev: true });

      const handler = (req: IncomingMessage, res: ServerResponse) => {
        if (req.url?.split('?')[0] === '/never-respond') {
          // Intentionally never respond.
          return;
        }

        if (req.url?.split('?')[0] === '/serviceWorker.js') {
          // Service worker scripts must be served from a stable root-like path.
          const originalUrl = req.url;
          req.url = '/serviceWorker.js';
          serveWorkers(req, res, () => {
            req.url = originalUrl;
            serveInOrder(req, res, [serveDist, serveFixtures]);
          });
          return;
        }

        serveInOrder(req, res, [serveDist, serveFixtures]);
      };

      // Keep one dedicated fixture origin; cross-origin redirects use a
      // different hostname on the same fixture server port.
      try {
        state.fixtureServer = await startServer(handler, FIXTURE_PORT);
        state.ownsFixtureServer = true;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'EADDRINUSE') {
          throw error;
        }

        // Another setup instance already started this server.
      }
    })();
  }

  await state.setupPromise;
  state.refs += 1;

  return async () => {
    state.refs -= 1;
    if (state.refs > 0) {
      // Another setup consumer still needs the shared servers.
      return;
    }

    if (state.ownsFixtureServer) {
      await new Promise<void>((resolve, reject) => {
        state.fixtureServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    state.fixtureServer = undefined;
    state.ownsFixtureServer = false;
    state.setupPromise = undefined;
  };
}
