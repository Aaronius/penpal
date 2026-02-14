type WaitForMessageOptions<TData = unknown> = {
  source: Window | MessagePort;
  predicate: (event: MessageEvent<TData>) => boolean;
  timeoutMs?: number;
  timeoutMessage?: string;
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const waitForMessageFromSource = async <TData = unknown>({
  source,
  predicate,
  timeoutMs = 5000,
  timeoutMessage = 'Timed out waiting for message',
}: WaitForMessageOptions<TData>) => {
  let handleMessage: ((event: MessageEvent<TData>) => void) | undefined;

  try {
    return await withTimeout(
      new Promise<MessageEvent<TData>>((resolve) => {
        handleMessage = (event: MessageEvent<TData>) => {
          if (event.source !== source) {
            return;
          }

          if (!predicate(event)) {
            return;
          }

          window.removeEventListener('message', handleMessage as EventListener);
          resolve(event);
        };

        window.addEventListener('message', handleMessage as EventListener);
      }),
      timeoutMs,
      timeoutMessage
    );
  } finally {
    if (handleMessage) {
      window.removeEventListener('message', handleMessage as EventListener);
    }
  }
};
