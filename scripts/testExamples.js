import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startExamplesServer } from './serveExamples.js';

const scenarios = [
  { name: 'iframe', path: '/iframe/index.html' },
  {
    action: async (page) => {
      await page.locator('[data-open-window]').click();
    },
    name: 'opened window',
    path: '/opened-window/index.html',
  },
  { name: 'dedicated worker', path: '/worker/index.html' },
  { name: 'shared worker', path: '/shared-worker/index.html' },
  { name: 'service worker', path: '/service-worker/index.html' },
];

const expectedResults = {
  add: '8',
  divide: '3',
  multiply: '12',
};

const server = await startExamplesServer({ port: 0 });
let browser;

try {
  browser = await chromium.launch();
  const indexContext = await browser.newContext();
  const indexPage = await indexContext.newPage();
  await indexPage.goto(server.url);
  const exampleLinks = await indexPage.locator('main nav a').count();
  assert.equal(
    exampleLinks,
    scenarios.length,
    'Expected one link per example.',
  );
  await indexContext.close();

  for (const scenario of scenarios) {
    const context = await browser.newContext();
    const browserErrors = [];
    const trackedPages = new WeakSet();
    const trackPage = (page) => {
      if (trackedPages.has(page)) {
        return;
      }

      trackedPages.add(page);
      page.on('console', (message) => {
        if (message.type() === 'error') {
          browserErrors.push(message.text());
        }
      });
      page.on('pageerror', (error) => {
        browserErrors.push(error.message);
      });
    };

    context.on('page', trackPage);
    const page = await context.newPage();
    trackPage(page);

    try {
      await page.goto(`${server.url}${scenario.path}`);
      await scenario.action?.(page);
      await page
        .locator('[data-status][data-state="connected"]')
        .waitFor({ timeout: 15000 });

      for (const [key, expectedValue] of Object.entries(expectedResults)) {
        const value = await page
          .locator(`[data-result="${key}"]`)
          .evaluate((output) => output.value);
        assert.equal(
          value,
          expectedValue,
          `${scenario.name} returned an unexpected ${key} result.`,
        );
      }

      assert.deepEqual(
        browserErrors,
        [],
        `${scenario.name} emitted browser errors.`,
      );
      console.log(`${scenario.name} example passed`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
