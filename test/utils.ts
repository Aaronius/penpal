import { connectToChild, ErrorCode, Methods, PenpalError } from '../src/index';
import { CHILD_SERVER } from './constants';

export const createAndAddIframe = (url?: string) => {
  const iframe = document.createElement('iframe');
  if (url) {
    iframe.src = url;
  }
  document.body.appendChild(iframe);
  return iframe;
};

export const createIframeAndConnection = <TMethods extends Methods>({
  methods = {},
  pageName = 'general',
}: {
  methods?: Methods;
  pageName?: string;
} = {}) => {
  const connection = connectToChild<TMethods>({
    child: createAndAddIframe(getPageFixtureUrl(pageName)),
    methods,
  });
  return connection;
};

export const createWorkerAndConnection = <TMethods extends Methods>({
  methods = {},
  workerName = 'general',
}: {
  methods?: Methods;
  workerName?: string;
} = {}) => {
  const worker = new Worker(getWorkerFixtureUrl(workerName));
  const connection = connectToChild<TMethods>({
    child: worker,
    methods,
  });
  return connection;
};

export const getPageFixtureUrl = (pageName: string, server = CHILD_SERVER) => {
  return `${server}/pages/${pageName}.html`;
};

export const getWorkerFixtureUrl = (workerName: string) => {
  return `/base/test/childFixtures/workers/${workerName}.js`;
};

/**
 * Asserts that the connection promise is never resolved or rejected. This can
 * happen, for example, when a target origin is valid but doesn't match the
 * remote's origin or if the remote isn't running Penpal.
 */
export const expectNeverFulfilledIframeConnection = (
  connectionPromise: Promise<unknown>,
  iframe: HTMLIFrameElement
) => {
  const spy = jasmine.createSpy();

  connectionPromise.then(spy, spy);

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

export const expectRejectedConnection = async (
  connectionPromise: Promise<unknown>,
  expectedErrorCode: ErrorCode
) => {
  const spy = jasmine.createSpy();
  await connectionPromise.catch(spy);
  expect(spy).toHaveBeenCalled();
  const error = spy.calls.mostRecent().args[0] as PenpalError;
  expect(error.code).toEqual(expectedErrorCode);
};
