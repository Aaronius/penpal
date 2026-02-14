import { afterEach, beforeAll, vi } from 'vitest';

const ensureGeneralFixtureMethodsLoaded = async () => {
  if (window.PenpalGeneralFixtureMethods) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/shared/generalMethods.js';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () =>
        reject(new Error('Failed to load /shared/generalMethods.js fixture')),
      { once: true }
    );
    document.head.appendChild(script);
  });
};

beforeAll(async () => {
  await ensureGeneralFixtureMethodsLoaded();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  document.body.replaceChildren();
});
