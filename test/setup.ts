import { afterEach, vi } from 'vitest';

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  document.body.replaceChildren();
});
