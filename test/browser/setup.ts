import { afterAll, afterEach, beforeAll, vi } from 'vitest';

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

const ignoredUnhandledRejectionHandler = (event: PromiseRejectionEvent) => {
  const reason = event.reason as { name?: string; message?: string };

  if (
    reason?.name === 'DataCloneError' &&
    typeof reason.message === 'string' &&
    (reason.message.includes('could not be cloned') ||
      reason.message.includes('Cannot clone'))
  ) {
    event.preventDefault();
  }
};

beforeAll(() => {
  window.addEventListener(
    'unhandledrejection',
    ignoredUnhandledRejectionHandler
  );
});

afterAll(() => {
  window.removeEventListener(
    'unhandledrejection',
    ignoredUnhandledRejectionHandler
  );
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  document.body.replaceChildren();
});
