const waitForNoServiceWorkerRegistrations = async (timeoutMs = 5000) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length === 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error('Timed out waiting for service worker unregistration');
};

export const unregisterAllServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((registration) => registration.unregister())
  );
  await waitForNoServiceWorkerRegistrations();
};

export const waitForServiceWorkerController = async (timeoutMs = 5000) => {
  if (navigator.serviceWorker.controller) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out waiting for service worker controller'));
    }, timeoutMs);

    const handleControllerChange = () => {
      clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
      resolve();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );
  });
};
