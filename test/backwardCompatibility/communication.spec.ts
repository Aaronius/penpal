import { createAndAddIframe } from '../utils.js';
import {
  connect,
  CallOptions,
  PenpalError,
  WindowMessenger,
} from '../../src/index.js';
import FixtureMethods from '../childFixtures/types/FixtureMethods.js';
import { CHILD_SERVER } from '../constants.js';

describe(`BACKWARD COMPATIBILITY: communication between parent and child iframe`, () => {
  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('calls a function on the child', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.destroy();
  });

  it('calls nested functions on the child', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    const oneLevel = await child.nested.oneLevel('pen');
    expect(oneLevel).toEqual('pen');
    const twoLevels = await child.nested.by.twoLevels('pal');
    expect(twoLevels).toEqual('pal');
    connection.destroy();
  });

  it('calls an asynchronous function on the child', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.destroy();
  });

  it('calls a function on the parent', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
      methods: {
        add: (num1: number, num2: number) => {
          return num1 + num2;
        },
      },
    });
    const child = await connection.promise;
    await child.addUsingParent();
    const value = await child.getParentReturnValue();
    expect(value).toEqual(9);
    connection.destroy();
  });

  it('handles promises rejected with strings', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    await expectAsync(child.getPromiseRejectedWithString()).toBeRejectedWith(
      'test error string'
    );
    connection.destroy();
  });

  it('handles promises rejected with objects', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    let error;
    try {
      await child.getPromiseRejectedWithObject();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual({ a: 'b' });
    connection.destroy();
  });

  it('handles promises rejected with undefined', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    let catchCalled = false;
    let error;
    try {
      await child.getPromiseRejectedWithUndefined();
    } catch (e) {
      catchCalled = true;
      error = e;
    }
    expect(catchCalled).toBeTrue();
    expect(error).toBeUndefined();
    connection.destroy();
  });

  it('handles promises rejected with error objects', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    let error;
    try {
      await child.getPromiseRejectedWithError();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect((error as Error).name).toBe('TypeError');
    expect((error as Error).message).toBe('test error object');
    expect((error as Error).stack).toEqual(jasmine.any(String));
    connection.destroy();
  });

  it('handles thrown errors', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    let error;
    try {
      await child.throwError();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect((error as Error).message).toBe('Oh nos!');
    connection.destroy();
  });

  it('handles unclonable values', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    let error;
    try {
      await child.getUnclonableValue();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect((error as Error).name).toBe('DataCloneError');
    connection.destroy();
  });

  it('rejects method call promise if method call timeout reached', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;
    const promise = child.neverResolve(
      new CallOptions({
        timeout: 0,
      })
    );

    let error;
    try {
      await promise;
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(jasmine.any(Error));
    expect((error as Error).message).toBe(
      'Method call neverResolve() timed out after 0ms'
    );
    expect((error as PenpalError).code).toBe('METHOD_CALL_TIMEOUT');
    connection.destroy();
  });

  it('rejects method call promise if connection is destroyed before reply is received', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });
    const child = await connection.promise;

    let error: Error;

    child.neverResolve().catch((e) => {
      error = e;
    });
    connection.destroy();

    // Wait for microtask queue to drain
    await Promise.resolve();

    expect(error!).toEqual(jasmine.any(Error));
    expect(error!.message).toBe(
      'Method call neverResolve() failed due to destroyed connection'
    );
    expect((error! as PenpalError).code).toBe('CONNECTION_DESTROYED');
    connection.destroy();
  });
});
