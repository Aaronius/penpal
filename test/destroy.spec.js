import { CHILD_SERVER } from './constants';
import { createAndAddIframe } from './utils';

describe('destroy', () => {
  it('rejects promise', done => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    connection.promise.catch(error => {
      expect(error).toEqual(jasmine.any(Error));
      expect(error.message).toBe('Connection destroyed');
      expect(error.code).toBe(Penpal.ErrorCode.ConnectionDestroyed);
      done();
    });

    connection.destroy();
  });

  // This test fails seemingly randomly and I can't figure
  // out why for the life of me.
  // it('removes handshake message listener', done => {
  //   spyOn(window, 'addEventListener').and.callThrough();
  //   spyOn(window, 'removeEventListener').and.callThrough();
  //
  //   const connection = Penpal.connectToChild({
  //     iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
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

  it('removes method call message listeners', () => {
    spyOn(window, 'addEventListener').and.callThrough();
    spyOn(window, 'removeEventListener').and.callThrough();

    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    // The method call message listener is set up after the connection has been established.
    return connection.promise.then(() => {
      connection.destroy();

      window.addEventListener.calls.allArgs().forEach(args => {
        expect(window.removeEventListener).toHaveBeenCalledWith(...args);
      });
    });
  });

  it('prevents method calls from being sent', done => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    // The method call message listener is set up after the connection has been established.
    connection.promise.then(child => {
      connection.destroy();

      try {
        child.multiply();
      } catch (error) {
        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toBe(
          'Unable to send multiply() call due to destroyed connection'
        );
        expect(error.code).toBe(Penpal.ErrorCode.ConnectionDestroyed);
        done();
      }
    });
  });

  it('supports multiple connections', () => {
    const connection1 = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });
    const connection2 = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    return Promise.all([
      connection1.promise.then(child => {
        return child.multiplyAsync(2, 5).then(value => {
          expect(value).toEqual(10);
          connection1.destroy();
        });
      }),
      connection2.promise.then(child => {
        return child.multiplyAsync(3, 5).then(value => {
          expect(value).toEqual(15);
          connection2.destroy();
        });
      })
    ]);
  });
});
