import { CHILD_SERVER } from './constants';
import { createAndAddIframe } from './utils';

describe('connection management', () => {
  it('connects to iframe when correct child origin provided', () => {
    const iframe = createAndAddIframe();

    const connection = Penpal.connectToChild({
      debug: true,
      iframe,
      childOrigin: CHILD_SERVER
    });

    // We're setting src after calling connectToChild to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/child.html`;

    return connection.promise;
  });

  it("doesn't connect to iframe when incorrect child origin provided", done => {
    const iframe = createAndAddIframe();

    const connection = Penpal.connectToChild({
      debug: true,
      iframe,
      childOrigin: 'http://bogus.com'
    });

    // We're setting src after calling connectToChild to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/child.html`;

    const spy = jasmine.createSpy();

    connection.promise.then(spy);

    iframe.addEventListener('load', function() {
      // Give Penpal time to try to make a handshake.
      setTimeout(() => {
        expect(spy).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    return connection.promise;
  });

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

  it('rejects promise if connectToChild times out', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(
        'http://www.fakeresponse.com/api/?sleep=10000'
      ),
      timeout: 0
    });

    return connection.promise.catch(error => {
      expect(error).toEqual(jasmine.any(Error));
      expect(error.message).toBe('Connection timed out after 0ms');
      expect(error.code).toBe(Penpal.ErrorCode.ConnectionTimeout);
    });
  });

  it(
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToChild)',
    () => {
      jasmine.clock().install();

      const iframe = createAndAddIframe(`${CHILD_SERVER}/child.html`);

      const connection = Penpal.connectToChild({
        iframe,
        timeout: 100000
      });

      return connection.promise.then(() => {
        jasmine.clock().tick(100001);

        expect(iframe.parentNode).not.toBeNull();

        jasmine.clock().uninstall();
        connection.destroy();
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
    () => {
      const iframe = createAndAddIframe(`${CHILD_SERVER}/child.html`);

      var connection = Penpal.connectToChild({
        iframe,
        appendTo: document.body
      });

      return connection.promise.then(child => {
        document.body.removeChild(iframe);

        let error;
        try {
          child.multiply(2, 3);
        } catch (err) {
          error = err;
        }

        expect(error).toBeDefined();
        expect(error.code).toBe(Penpal.ErrorCode.ConnectionDestroyed);
      });
    }
  );

  it(
    'destroys connection if iframe has been removed from DOM ' +
      'and method is called',
    () => {
      const iframe = createAndAddIframe(`${CHILD_SERVER}/child.html`);

      var connection = Penpal.connectToChild({
        iframe,
        appendTo: document.body
      });

      return connection.promise.then(child => {
        document.body.removeChild(iframe);

        let error;
        try {
          child.multiply(2, 3);
        } catch (err) {
          error = err;
        }

        expect(error).toBeDefined();
        expect(error.code).toBe(Penpal.ErrorCode.ConnectionDestroyed);
      });
    }
  );
});
