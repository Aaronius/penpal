import { afterEach, vi } from 'vitest';

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  document.body.replaceChildren();

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
  }
});
