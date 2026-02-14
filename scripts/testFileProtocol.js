#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

const browserTarget = (process.env.BROWSER ?? 'chromium').toLowerCase();

const launchers = {
  chromium: () => chromium.launch({ headless: true }),
  firefox: () => firefox.launch({ headless: true }),
  webkit: () => webkit.launch({ headless: true }),
  edge: () =>
    chromium.launch({
      channel: 'msedge',
      headless: true,
    }),
};

if (!(browserTarget in launchers)) {
  throw new Error(
    `Unsupported BROWSER "${browserTarget}". Use chromium, firefox, webkit, edge.`
  );
}

const parentUrl = pathToFileURL(path.resolve('test/fileProtocol/parent.html'))
  .href;
const expectedText = '3 X 2 = 6';
const timeoutMs = 15000;

const browser = await launchers[browserTarget]();
const page = await browser.newPage();

try {
  await page.goto(parentUrl);
  await page.getByText(expectedText, { exact: true }).waitFor({
    timeout: timeoutMs,
  });

  console.log(`[${browserTarget}] file protocol test passed`);
} catch (error) {
  const bodyText = await page.textContent('body').catch(() => '');
  console.error(
    `[${browserTarget}] file protocol test failed for ${parentUrl}`
  );
  console.error(`[${browserTarget}] body text at failure:\n${bodyText}`);
  throw error;
} finally {
  await page.close();
  await browser.close();
}
