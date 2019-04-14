import { CHILD_SERVER } from './constants';
import { createAndAddIframe } from './utils';

describe('connection management', () => {
  it("doesn't connect to iframe connecting to parent with different origin", done => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/childDiffOrigin.html`);

    const connection = Penpal.connectToChild({
      iframe
    });

    const spy = jasmine.createSpy();

    connection.promise.then(spy);

    iframe.addEventListener('load', function() {
      // Give Penpal time to try to make a handshake.
      setTimeout(() => {
        expect(spy).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  it('reconnects after child reloads', done => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    connection.promise.then(child => {
      const previousMultiply = child.multiply;

      const intervalId = setInterval(function() {
        // Detect reconnection
        if (child.multiply !== previousMultiply) {
          clearInterval(intervalId);
          child.multiply(2, 4).then(value => {
            expect(value).toEqual(8);
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.reload();
    });
  });

  // Issue #18
  it('properly disconnects previous call receiver upon reconnection', done => {
    const add = jasmine.createSpy().and.callFake((num1, num2) => {
      return num1 + num2;
    });

    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`),
      methods: {
        add
      }
    });

    connection.promise.then(child => {
      const previousAddUsingParent = child.addUsingParent;

      const intervalId = setInterval(function() {
        // Detect reconnection
        if (child.addUsingParent !== previousAddUsingParent) {
          clearInterval(intervalId);
          child.addUsingParent().then(() => {
            expect(add.calls.count()).toEqual(1);
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.reload();
    });
  });

  it('reconnects after child navigates to other page with different methods', done => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    connection.promise.then(child => {
      const intervalId = setInterval(function() {
        // Detect reconnection
        if (child.divide) {
          clearInterval(intervalId);
          expect(child.multiply).not.toBeDefined();
          child.divide(6, 3).then(value => {
            expect(value).toEqual(2);
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.navigate();
    });
  });

  it('rejects promise if connectToChild times out', done => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(
        'http://www.fakeresponse.com/api/?sleep=10000'
      ),
      timeout: 0
    });

    connection.promise.catch(error => {
      expect(error).toEqual(jasmine.any(Error));
      expect(error.message).toBe('Connection to child timed out after 0ms');
      expect(error.code).toBe(Penpal.ERR_CONNECTION_TIMEOUT);
      done();
    });
  });

  it(
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToChild)',
    done => {
      jasmine.clock().install();

      const iframe = createAndAddIframe(`${CHILD_SERVER}/child.html`);

      const connection = Penpal.connectToChild({
        iframe,
        timeout: 100000
      });

      connection.promise.then(() => {
        jasmine.clock().tick(100001);

        expect(iframe.parentNode).not.toBeNull();

        jasmine.clock().uninstall();
        connection.destroy();
        done();
      });
    }
  );

  it(
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToParent)',
    done => {
      var connection = Penpal.connectToChild({
        iframe: createAndAddIframe(
          `${CHILD_SERVER}/childTimeoutAfterSucceeded.html`
        ),
        methods: {
          reportStillConnected() {
            connection.destroy();
            done();
          }
        }
      });
    }
  );

  it(
    'destroys connection if iframe has been removed from DOM ' +
      'and method is called',
    done => {
      const iframe = createAndAddIframe(`${CHILD_SERVER}/child.html`);

      var connection = Penpal.connectToChild({
        iframe,
        appendTo: document.body
      });

      connection.promise.then(child => {
        document.body.removeChild(iframe);

        let error;
        try {
          child.multiply(2, 3);
        } catch (err) {
          error = err;
        }

        expect(error).toBeDefined();
        expect(error.code).toBe(Penpal.ERR_CONNECTION_DESTROYED);
        done();
      });
    }
  );

  it(
    'destroys connection if iframe has been removed from DOM ' +
      'and method is called',
    done => {
      const iframe = createAndAddIframe(`${CHILD_SERVER}/child.html`);

      var connection = Penpal.connectToChild({
        iframe,
        appendTo: document.body
      });

      connection.promise.then(child => {
        document.body.removeChild(iframe);

        let error;
        try {
          child.multiply(2, 3);
        } catch (err) {
          error = err;
        }

        expect(error).toBeDefined();
        expect(error.code).toBe(Penpal.ERR_CONNECTION_DESTROYED);
        done();
      });
    }
  );
});
