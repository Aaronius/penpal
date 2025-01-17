import { createAndAddIframe, createIframeAndConnection } from '../utils';
import {
  connectToChild,
  ErrorCode,
  MethodCallOptions,
  PenpalError,
} from '../../src/index';
import FixtureMethods from '../childFixtures/types/FixtureMethods';
import { CHILD_SERVER } from '../constants';

describe(`backward compatibility - communication between parent and child iframe`, () => {
  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('calls a function on the child', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
    });
    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.close();
  });

  it('calls nested functions on the child', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
    });
    const child = await connection.promise;
    const oneLevel = await child.nested.oneLevel('pen');
    expect(oneLevel).toEqual('pen');
    const twoLevels = await child.nested.by.twoLevels('pal');
    expect(twoLevels).toEqual('pal');
    connection.close();
  });

  it('calls an asynchronous function on the child', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
    });
    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.close();
  });

  it('calls a function on the parent', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
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
    connection.close();
  });

  it('handles promises rejected with strings', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
    });
    const child = await connection.promise;
    await expectAsync(child.getPromiseRejectedWithString()).toBeRejectedWith(
      'test error string'
    );
    connection.close();
  });

  it('handles promises rejected with error objects', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
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
    connection.close();
  });

  it('handles promises rejected with undefined', async () => {
    const connection = createIframeAndConnection<FixtureMethods>();
    const child = await connection.promise;
    await expectAsync(child.getPromiseRejectedWithUndefined()).toBeRejectedWith(
      undefined
    );
    connection.close();
  });

  it('handles thrown errors', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
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
    connection.close();
  });

  it('handles unclonable values', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
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
    connection.close();
  });

  it('rejects method call promise if method call timeout reached', async () => {
    jasmine.clock().install();
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
    });
    const child = await connection.promise;
    const promise = child.neverResolve(
      new MethodCallOptions({
        timeout: 1000,
      })
    );
    jasmine.clock().tick(999);
    await expectAsync(promise).toBePending();
    jasmine.clock().tick(1);

    let error;
    try {
      await promise;
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(jasmine.any(Error));
    expect((error as Error).message).toBe(
      'Method call neverResolve() timed out after 1000ms'
    );
    expect((error as PenpalError).code).toBe(ErrorCode.MethodCallTimeout);
    connection.close();
  });

  it('rejects method call promise if connection is closed before reply is received', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
    });
    const child = await connection.promise;

    let error: Error;

    child.neverResolve().catch((e) => {
      error = e;
    });
    connection.close();

    // Wait for microtask queue to drain
    await Promise.resolve();

    expect(error!).toEqual(jasmine.any(Error));
    expect(error!.message).toBe(
      'Method call neverResolve() cannot be resolved due to closed connection'
    );
    expect((error! as PenpalError).code).toBe(ErrorCode.ConnectionClosed);
    connection.close();
  });
});
