import { CHILD_SERVER } from './constants';
import { createAndAddIframe } from './utils';
import { connectToChildIframe, ErrorCode } from '../src/index';

describe('destroy', () => {
  // Issue #51
  it('does not resolve or reject promise', async () => {
    const connection = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    connection.destroy();

    await expectAsync(connection.promise).toBePending();
  });

  it('removes method listener', async () => {
    const addEventListenerSpy = spyOn(
      window,
      'addEventListener'
    ).and.callThrough();
    const removeEventListenerSpy = spyOn(
      window,
      'removeEventListener'
    ).and.callThrough();

    const connection = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    // The method call message listener is set up after the connection has been established.
    await connection.promise;
    connection.destroy();

    expect(addEventListenerSpy.calls.count()).toBe(1);
    addEventListenerSpy.calls.allArgs().forEach((args) => {
      expect(removeEventListenerSpy).toHaveBeenCalledWith(...args);
    });
  });

  it('prevents method calls from being sent', async () => {
    const connection = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    // The method call message listener is set up after the connection has been established.

    const child = await connection.promise;
    connection.destroy();

    let error;
    try {
      // @ts-expect-error
      child.multiply();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect(error.message).toBe(
      'Unable to send multiply() call due to destroyed connection'
    );
    expect(error.code).toBe(ErrorCode.ConnectionDestroyed);
  });

  it('supports multiple connections', async () => {
    const connection1 = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });
    const connection2 = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    await Promise.all([
      connection1.promise.then(async (child) => {
        // @ts-expect-error
        const value = await child.multiplyAsync(2, 5);
        expect(value).toEqual(10);
        connection1.destroy();
      }),
      connection2.promise.then(async (child) => {
        // @ts-expect-error
        const value = await child.multiplyAsync(3, 5);
        expect(value).toEqual(15);
        connection2.destroy();
      }),
    ]);
  });
});
