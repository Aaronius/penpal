import type { UnspecifiedRemoteMethods } from '../../src/types.js';
import {
  PenpalError,
  Reply,
  connect,
  type MethodsShape,
  PortMessenger,
  WindowMessenger,
} from '../../src/index.js';
import { CHILD_SERVER } from './constants.js';
import WebWorkerMessenger from '../../src/messengers/WebWorkerMessenger.js';

export const createAndAddIframe = (url: string) => {
  const iframe = document.createElement('iframe');
  iframe.src = url;
  document.body.appendChild(iframe);
  return iframe!;
};

export const createIframeAndConnection = <
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
>({
  methods = {},
  pageName = 'general',
  timeout,
}: {
  methods?: object;
  pageName?: string;
  timeout?: number;
} = {}) => {
  // For iframe tests, the remote side is provided by the fixture page
  // (e.g. pages/general.html), so this helper only needs to create the
  // parent-side connection.
  const iframe = createAndAddIframe(getPageFixtureUrl(pageName, CHILD_SERVER));
  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
    allowedOrigins: [CHILD_SERVER],
  });
  const connection = connect<TRemoteMethods>({
    messenger,
    methods,
    ...(timeout === undefined ? {} : { timeout }),
    // log: debug('Parent')
  });
  return connection;
};

export const createWorkerAndConnection = <
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
>({
  methods = {},
  workerName = 'webWorkerGeneral',
  timeout,
}: {
  methods?: object;
  workerName?: string;
  timeout?: number;
} = {}) => {
  // For worker tests, the worker fixture already initializes Penpal and
  // exposes methods, so this helper only creates the parent-side connection.
  const worker = new Worker(getWorkerFixtureUrl(workerName));
  const messenger = new WebWorkerMessenger({
    worker,
  });
  const connection = connect<TRemoteMethods>({
    messenger,
    methods,
    ...(timeout === undefined ? {} : { timeout }),
    // log: debug('Parent')
  });
  return connection;
};

export const createPortAndConnection = <
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
>({
  methods = {},
  timeout,
}: {
  methods?: object;
  timeout?: number;
} = {}) => {
  if (!window.PenpalGeneralFixtureMethods) {
    throw new Error(
      'window.PenpalGeneralFixtureMethods is not loaded in test setup',
    );
  }

  const { port1, port2 } = new MessageChannel();

  let parentReturnValue: number | undefined;
  const parentProxyPromiseRef: {
    current?: Promise<Record<string, unknown>>;
  } = {};

  // Unlike iframe/worker helpers, a MessageChannel has no fixture-backed
  // "remote app". We must bootstrap both sides in-process: port1 is the
  // parent-side connection returned to the test, and port2 acts as the
  // remote-side connection with fixture-equivalent methods.
  const remoteMethods = window.PenpalGeneralFixtureMethods.createGeneralMethods(
    {
      getParentApi: () => parentProxyPromiseRef.current!,
      setParentReturnValue: (value) => {
        parentReturnValue = value;
      },
      getParentReturnValue: () => {
        return parentReturnValue;
      },
      getUnclonableValue: () => {
        return window;
      },
      createReply: (value, options) => {
        return new Reply(value, options);
      },
    },
  );

  const remoteConnection = connect({
    messenger: new PortMessenger({
      port: port2,
    }),
    methods: remoteMethods,
  });
  void remoteConnection.promise.catch(() => {
    // Remote-side destruction is expected when the parent-side test connection
    // is destroyed before both sides finish establishing the connection.
  });

  parentProxyPromiseRef.current = remoteConnection.promise as Promise<
    Record<string, unknown>
  >;

  const connection = connect<TRemoteMethods>({
    messenger: new PortMessenger({
      port: port1,
    }),
    methods,
    ...(timeout === undefined ? {} : { timeout }),
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

export const expectConnectionToTimeout = async (
  connection: { promise: Promise<unknown>; destroy: () => void },
  expected: { message?: string } = {},
) => {
  await expect(connection.promise).rejects.toBeInstanceOf(PenpalError);
  await expect(connection.promise).rejects.toMatchObject({
    code: 'CONNECTION_TIMEOUT',
    ...expected,
  });

  connection.destroy();
};
