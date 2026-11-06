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
  {
    action: async (page) => {
      await page.getByRole('button', { name: 'Start', exact: true }).click();
    },
    check: async (page) => {
      const tone = page.locator('[data-tone]');
      await tone.filter({ hasText: /^Playing$/ }).waitFor();
      await page.getByRole('button', { name: 'Mute', exact: true }).click();
      await tone.filter({ hasText: /^Muted$/ }).waitFor();
      await page.getByRole('button', { name: 'Unmute', exact: true }).click();
      await tone.filter({ hasText: /^Playing$/ }).waitFor();
      await page.getByRole('button', { name: 'Stop', exact: true }).click();
      await tone.filter({ hasText: /^Stopped$/ }).waitFor();
    },
    name: 'AudioWorklet',
    path: '/audio-worklet/index.html',
  },
];

const expectedResults = {
  add: '8',
  divide: '3',
  multiply: '12',
};

const checkArithmeticResults = async (page, name) => {
  for (const [key, expectedValue] of Object.entries(expectedResults)) {
    const output = page.locator(`[data-result="${key}"][data-ready="true"]`);
    await output.waitFor({ timeout: 15000 });
    const value = await output.evaluate((element) => element.value);
    assert.equal(
      value,
      expectedValue,
      `${name} returned an unexpected ${key} result.`,
    );
  }
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

      const check = scenario.check ?? checkArithmeticResults;
      await check(page, scenario.name);

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
