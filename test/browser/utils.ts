import {
  Connection,
  Reply,
  connect,
  Methods,
  PortMessenger,
  WindowMessenger,
} from '../../src/index.js';
import { CHILD_SERVER } from './constants.js';
import WorkerMessenger from '../../src/messengers/WorkerMessenger.js';

export const createAndAddIframe = (url: string) => {
  const iframe = document.createElement('iframe');
  iframe.src = url;
  document.body.appendChild(iframe);
  return iframe!;
};

export const createIframeAndConnection = <TMethods extends Methods>({
  methods = {},
  pageName = 'general',
  timeout,
}: {
  methods?: Methods;
  pageName?: string;
  timeout?: number;
} = {}) => {
  const iframe = createAndAddIframe(getPageFixtureUrl(pageName, CHILD_SERVER));
  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
    allowedOrigins: [CHILD_SERVER],
  });
  const connection = connect<TMethods>({
    messenger,
    methods,
    ...(timeout === undefined ? {} : { timeout }),
    // log: debug('Parent')
  });
  return connection;
};

export const createWorkerAndConnection = <TMethods extends Methods>({
  methods = {},
  workerName = 'webWorkerGeneral',
  timeout,
}: {
  methods?: Methods;
  workerName?: string;
  timeout?: number;
} = {}) => {
  const worker = new Worker(getWorkerFixtureUrl(workerName));
  const messenger = new WorkerMessenger({
    worker,
  });
  const connection = connect<TMethods>({
    messenger,
    methods,
    ...(timeout === undefined ? {} : { timeout }),
    // log: debug('Parent')
  });
  return connection;
};

export const createPortAndConnection = <TMethods extends Methods>({
  methods = {},
  timeout,
}: {
  methods?: Methods;
  timeout?: number;
} = {}) => {
  if (!window.PenpalGeneralFixtureMethods) {
    throw new Error(
      'window.PenpalGeneralFixtureMethods is not loaded in test setup'
    );
  }

  const { port1, port2 } = new MessageChannel();

  let parentReturnValue: number | undefined;
  const parentProxyPromiseRef: {
    current?: Promise<Record<string, unknown>>;
  } = {};

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
    }
  );

  const remoteConnection = connect<Methods>({
    messenger: new PortMessenger({
      port: port2,
    }),
    methods: remoteMethods,
  });

  parentProxyPromiseRef.current = remoteConnection.promise as Promise<
    Record<string, unknown>
  >;

  const connection = connect<TMethods>({
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

export const expectConnectionToTimeout = async (connection: Connection) => {
  const error = await connection.promise.catch((caughtError) => {
    return caughtError as Error & { code?: string };
  });

  expect(error).toEqual(expect.any(Error));
  expect(error).toMatchObject({
    code: 'CONNECTION_TIMEOUT',
  });

  connection.destroy();

  return error;
};
