import { Connection, connect, Methods, WindowMessenger } from '../src/index.js';
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

export const getPageFixtureUrl = (pageName: string, server = CHILD_SERVER) => {
  return `${server}/pages/${pageName}.html`;
};

export const getWorkerFixtureUrl = (workerName: string) => {
  return `/workers/${workerName}.js`;
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
  const spy = jasmine.createSpy();

  connection.promise.then(spy, spy);

  return new Promise<void>((resolve) => {
    iframe.addEventListener('load', function () {
      // Give Penpal time to try to make a handshake.
      setTimeout(() => {
        expect(spy).not.toHaveBeenCalled();
        resolve();
      }, 100);
    });
  });
};
