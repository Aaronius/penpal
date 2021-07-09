import { CHILD_SERVER } from './constants';
import { createAndAddIframe } from './utils';

describe('destroy', () => {
  // Issue #51
  it('does not resolve or reject promise', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    connection.destroy();

    await expectAsync(connection.promise).toBePending();
  });

  // This test fails seemingly randomly and I can't figure
  // out why for the life of me.
  // it('removes handshake message listener', done => {
  //   spyOn(window, 'addEventListener').and.callThrough();
  //   spyOn(window, 'removeEventListener').and.callThrough();
  //
  //   const connection = Penpal.connectToChild({
  //     iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`)
  //   });
  //
  //   // The handshake message listener is set up immediately after the iframe has loaded.
  //   connection.iframe.addEventListener('load', () => {
  //     connection.destroy();
  //
  //     window.addEventListener.calls.allArgs().forEach(args => {
  //       expect(window.removeEventListener).toHaveBeenCalledWith(...args);
  //     });
  //
  //     done();
  //   });
  // });

  it('removes method call message listeners', async () => {
    spyOn(window, 'addEventListener').and.callThrough();
    spyOn(window, 'removeEventListener').and.callThrough();

    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    // The method call message listener is set up after the connection has been established.
    await connection.promise;
    connection.destroy();

    expect(window.addEventListener.calls.count()).toBe(2);
    window.addEventListener.calls.allArgs().forEach((args) => {
      expect(window.removeEventListener).toHaveBeenCalledWith(...args);
    });
  });

  it('prevents method calls from being sent', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    // The method call message listener is set up after the connection has been established.

    const child = await connection.promise;
    connection.destroy();

    let error;
    try {
      child.multiply();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect(error.message).toBe(
      'Unable to send multiply() call due to destroyed connection'
    );
    expect(error.code).toBe(Penpal.ErrorCode.ConnectionDestroyed);
  });

  it('supports multiple connections', async () => {
    const connection1 = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });
    const connection2 = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    await Promise.all([
      connection1.promise.then(async (child) => {
        const value = await child.multiplyAsync(2, 5);
        expect(value).toEqual(10);
        connection1.destroy();
      }),
      connection2.promise.then(async (child) => {
        const value = await child.multiplyAsync(3, 5);
        expect(value).toEqual(15);
        connection2.destroy();
      }),
    ]);
  });
});
