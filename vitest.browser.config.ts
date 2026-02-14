import path from 'node:path';
import serveStatic from 'serve-static';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

const browserTarget = (process.env.BROWSER ?? 'chromium').toLowerCase();
const isEdge = browserTarget === 'edge';
const browserName = isEdge ? 'chromium' : browserTarget;
const testInclude = process.env.TEST_GLOB
  ? [process.env.TEST_GLOB]
  : ['test/**/*.spec.ts'];

if (!['chromium', 'firefox', 'webkit'].includes(browserName)) {
  throw new Error(
    `Unsupported browser target "${browserTarget}". Use one of chromium, firefox, webkit, edge.`
  );
}

const fixtureRoot = path.resolve('test/childFixtures');
const workerRoot = path.join(fixtureRoot, 'workers');
const distRoot = path.resolve('dist');

export default defineConfig({
  plugins: [
    {
      name: 'penpal-test-fixtures',
      configureServer(server) {
        const serveDist = serveStatic(distRoot);
        const serveFixtures = serveStatic(fixtureRoot);
        const serveWorkers = serveStatic(workerRoot);

        server.middlewares.use('/never-respond', () => {
          // Intentionally never respond.
        });

        server.middlewares.use((req, res, next) => {
          if (req.url?.split('?')[0] !== '/serviceWorker.js') {
            next();
            return;
          }

          const originalUrl = req.url;
          req.url = '/serviceWorker.js';
          serveWorkers(req, res, (error) => {
            req.url = originalUrl;
            next(error);
          });
        });

        server.middlewares.use(serveDist);
        server.middlewares.use(serveFixtures);
      },
    },
  ],
  test: {
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    include: testInclude,
    exclude: ['test/types/**', 'test/unit/**'],
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: isEdge
          ? {
              channel: 'msedge',
            }
          : {},
      }),
      instances: [
        {
          browser: browserName as 'chromium' | 'firefox' | 'webkit',
        },
      ],
    },
  },
});
