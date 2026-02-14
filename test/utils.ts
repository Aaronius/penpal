import {
  Connection,
  connect,
  Methods,
  PortMessenger,
  Reply,
  WindowMessenger,
} from '../src/index.js';
import type { RemoteProxy } from '../src/index.js';
import { CHILD_SERVER } from './constants.js';
import WorkerMessenger from '../src/messengers/WorkerMessenger.js';

export const createAndAddIframe = (url: string) => {
  const iframe = document.createElement('iframe');
  iframe.src = url;
  document.body.appendChild(iframe);
  return iframe!;
};

export const createIframeAndConnection = <TMethods extends Methods>({
  methods = {},
  pageName = 'general',
}: {
  methods?: Methods;
  pageName?: string;
} = {}) => {
  const iframe = createAndAddIframe(getPageFixtureUrl(pageName, CHILD_SERVER));
  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
    allowedOrigins: [CHILD_SERVER],
  });
  const connection = connect<TMethods>({
    messenger,
    methods,
    // log: debug('Parent')
  });
  return connection;
};

export const createWorkerAndConnection = <TMethods extends Methods>({
  methods = {},
  workerName = 'webWorkerGeneral',
}: {
  methods?: Methods;
  workerName?: string;
} = {}) => {
  const worker = new Worker(getWorkerFixtureUrl(workerName));
  const messenger = new WorkerMessenger({
    worker,
  });
  const connection = connect<TMethods>({
    messenger,
    methods,
    // log: debug('Parent')
  });
  return connection;
};

export const createPortAndConnection = <TMethods extends Methods>({
  methods = {},
}: {
  methods?: Methods;
} = {}) => {
  const { port1, port2 } = new MessageChannel();

  let parentReturnValue: number | undefined;
  const parentProxyPromiseRef: { current?: Promise<RemoteProxy<Methods>> } = {};

  const remoteMethods: Methods = {
    multiply(num1: number, num2: number) {
      return num1 * num2;
    },
    multiplyAsync(num1: number, num2: number) {
      return Promise.resolve(num1 * num2);
    },
    double(numbersArray: Int32Array) {
      const resultArray = numbersArray.map((num) => num * 2);
      return new Reply(resultArray, {
        transferables: [resultArray.buffer],
      });
    },
    multiplyWithPromisedReplyInstanceAndPromisedReturnValue(
      num1: number,
      num2: number
    ) {
      return Promise.resolve(new Reply(Promise.resolve(num1 * num2)));
    },
    addUsingParent() {
      return parentProxyPromiseRef
        .current!.then((parentProxy) => parentProxy.add(3, 6))
        .then((value) => {
          parentReturnValue = value as number;
        });
    },
    getParentReturnValue() {
      return parentReturnValue;
    },
    getPromiseRejectedWithString() {
      return Promise.reject('test error string');
    },
    getPromiseRejectedWithObject() {
      return Promise.reject({ a: 'b' });
    },
    getPromiseRejectedWithUndefined() {
      return Promise.reject();
    },
    getPromiseRejectedWithError() {
      return Promise.reject(new TypeError('test error object'));
    },
    throwError() {
      throw new Error('Oh nos!');
    },
    getUnclonableValue() {
      return window;
    },
    apply() {
      return 'apply result';
    },
    call() {
      return 'call result';
    },
    bind() {
      return 'bind result';
    },
    nested: {
      oneLevel(input: unknown) {
        return input;
      },
      by: {
        twoLevels(input: unknown) {
          return input;
        },
      },
      apply() {
        return 'apply result';
      },
    },
    neverResolve() {
      return new Promise(() => {
        // Intentionally never resolves.
      });
    },
    ['with.period']() {
      return 'success';
    },
  };

  const remoteConnection = connect<Methods>({
    messenger: new PortMessenger({
      port: port2,
    }),
    methods: remoteMethods,
  });

  parentProxyPromiseRef.current = remoteConnection.promise as Promise<
    RemoteProxy<Methods>
  >;

  const connection = connect<TMethods>({
    messenger: new PortMessenger({
      port: port1,
    }),
    methods,
  });

  return {
    promise: connection.promise,
    destroy() {
      connection.destroy();
      remoteConnection.destroy();
    },
  };
};

export const getPageFixtureUrl = (pageName: string, server = CHILD_SERVER) => {
  return `${server}/pages/${pageName}.html`;
};

export const getWorkerFixtureUrl = (workerName: string) => {
  return `/workers/${workerName}.js`;
};

export const expectPromiseToStayPending = async (
  promise: Promise<unknown>,
  waitTimeMs = 50
) => {
  let settled = false;

  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );

  await new Promise((resolve) => {
    setTimeout(resolve, waitTimeMs);
  });

  expect(settled).toBe(false);
};

/**
 * Asserts that the connection promise is never resolved or rejected. This can
 * happen, for example, when a target origin is valid but doesn't match the
 * remote's origin or if the remote isn't running Penpal.
 */
export const expectNeverFulfilledIframeConnection = (
  connection: Connection,
  iframe: HTMLIFrameElement
) => {
  const spy = vi.fn();

  connection.promise.then(spy, spy);

  const waitForLoad = () =>
    new Promise<void>((resolve) => {
      if (iframe.contentDocument?.readyState === 'complete') {
        resolve();
        return;
      }

      iframe.addEventListener('load', () => resolve(), { once: true });
    });

  return waitForLoad().then(
    () =>
      new Promise<void>((resolve) => {
        // Give Penpal time to try to make a handshake.
        setTimeout(() => {
          expect(spy).not.toHaveBeenCalled();
          connection.destroy();
          resolve();
        }, 200);
      })
  );
};
