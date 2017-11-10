const CHILD_SERVER = `http://${window.location.hostname}:9000`;

describe('Penpal', () => {
  beforeAll(() => {
    Penpal.Promise = RSVP.Promise;
    Penpal.debug = true;
  });

  it('should complete a handshake', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(() => {
      connection.destroy();
      done();
    });
  });

  it('should create an iframe and add it to document.body', () => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    expect(connection.iframe).toBeDefined();
    expect(connection.iframe.src).toBe(`${CHILD_SERVER}/child.html`);
    expect(connection.iframe.parentNode).toBe(document.body);
  });

  it('should create an iframe and add it to a specific element', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`,
      appendTo: container
    });

    expect(connection.iframe).toBeDefined();
    expect(connection.iframe.src).toBe(`${CHILD_SERVER}/child.html`);
    expect(connection.iframe.parentNode).toBe(container);
  });

  it('should call a function on the child', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then((child) => {
      child.multiply(2, 5).then((value) => {
        expect(value).toEqual(10);
        connection.destroy();
        done();
      });
    });
  });
  
  it('should call a function on the child with origin set', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/childOrigin.html`
    });

    connection.promise.then((child) => {
      child.multiply(2, 5).then((value) => {
        expect(value).toEqual(10);
        connection.destroy();
        done();
      });
    });
  });

  it('should call an asynchronous function on the child', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then((child) => {
      child.multiplyAsync(2, 5).then((value) => {
        expect(value).toEqual(10);
        connection.destroy();
        done();
      });
    });
  });

  it('should call a function on the parent', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`,
      methods: {
        add: (num1, num2) => {
          return num1 + num2;
        }
      }
    });

    connection.promise.then((child) => {
      child.addUsingParent().then(() => {
        child.getParentReturnValue().then((value) => {
          expect(value).toEqual(9);
          connection.destroy();
          done();
        });
      });
    });
  });

  it('should handle rejected promises', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`,
    });

    connection.promise.then((child) => {
      child.getRejectedPromise().then(
        () => {},
        (error) => {
          expect(error).toBe('test error message');
          connection.destroy();
          done();
        }
      )
    });
  });

  it('should handle thrown errors', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`,
    });

    connection.promise.then((child) => {
      child.throwError().then(
        () => {},
        (error) => {
          expect(error).toContain('Oh nos!');
          connection.destroy();
          done();
        }
      )
    });
  });

  it('should handle unclonable values', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`,
    });

    connection.promise.then((child) => {
      child.getUnclonableValue().then(
        () => {},
        (error) => {
          expect(error).toContain('DataCloneError');
          connection.destroy();
          done();
        }
      )
    });
  });

  it('should not connect to iframe connecting to parent with different origin', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/childDiffOrigin.html`
    });

    const spy = jasmine.createSpy();

    connection.promise.then(spy);

    connection.iframe.addEventListener('load', function() {
      // Give Penpal time to try to make a handshake.
      setTimeout(() => {
        expect(spy).not.toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  it('should reconnect after child reloads', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then((child) => {
      const previousMultiply = child.multiply;

      const intervalId = setInterval(function() {
        // Detect reconnection
        if (child.multiply !== previousMultiply) {
          clearInterval(intervalId);
          child.multiply(2, 4).then((value) => {
            expect(value).toEqual(8);
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.reload();
    });
  });

  it('should reconnect after child navigates to other page with different methods', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then((child) => {
      const intervalId = setInterval(function() {
        // Detect reconnection
        if (child.divide) {
          clearInterval(intervalId);
          expect(child.multiply).not.toBeDefined();
          child.divide(6, 3).then((value) => {
            expect(value).toEqual(2);
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.navigate();
    });
  });

  it('should reject promise if connectToChild times out', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`,
      timeout: 0
    });

    connection.promise.catch((error) => {
      expect(error).toEqual(jasmine.any(Error));
      expect(error.message).toBe('Connection to child timed out after 0ms');
      done();
    });
  });

  it('should reject promise if connectToParent times out', (done) => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/childTimeout.html`
    });

    connection.promise.then((child) => {
      // Detect reconnection
      const intervalId = setInterval(function() {
        if (child.getTimeoutErrorMessage) {
          clearInterval(intervalId);
          child.getTimeoutErrorMessage().then(function(errorMessage) {
            expect(errorMessage).toBe('Connection to parent timed out after 0ms');
            connection.destroy();
            done();
          })
        }
      }, 10);
    });
  });

  describe('destroy', () => {
    it('should remove iframe from its parent', (done) => {
      const connection = Penpal.connectToChild({
        url: `${CHILD_SERVER}/child.html`
      });

      connection.destroy();

      expect(connection.iframe.parentNode).toBeNull();
      done();
    });

    it('should reject promise', (done) => {
      const connection = Penpal.connectToChild({
        url: `${CHILD_SERVER}/child.html`
      });

      connection.promise.then(
        () => {},
        (error) => {
          expect(error).toBe('Parent: Connection destroyed');
          done();
        }
      );

      connection.destroy();
    });

    // When this test runs in IE, we get an "Object Expected" error within the iframe due to the
    // Array constructor not existing. It appears that when we call connection.destroy(), which
    // removes the iframe, IE messes up the Array constructor within the detached iframe.
    it('should remove handshake message listener', (done) => {
      spyOn(window, 'addEventListener').and.callThrough();
      spyOn(window, 'removeEventListener').and.callThrough();

      const connection = Penpal.connectToChild({
        url: `${CHILD_SERVER}/child.html`
      });


      // The handshake message listener is set up immediately after the iframe has loaded.
      connection.iframe.addEventListener('load', () => {
        connection.destroy();

        window.addEventListener.calls.allArgs().forEach(args => {
          expect(window.removeEventListener).toHaveBeenCalledWith(...args);
        });

        done();
      });
    });

    it('should remove method call message listeners', (done) => {
      spyOn(window, 'addEventListener').and.callThrough();
      spyOn(window, 'removeEventListener').and.callThrough();

      const connection = Penpal.connectToChild({
        url: `${CHILD_SERVER}/child.html`
      });

      // The method call message listener is set up after the connection has been established.
      connection.promise.then(() => {
        connection.destroy();

        window.addEventListener.calls.allArgs().forEach(args => {
          expect(window.removeEventListener).toHaveBeenCalledWith(...args);
        });

        done();
      });
    });

    it('should prevent method calls from being sent', (done) => {
      const connection = Penpal.connectToChild({
        url: `${CHILD_SERVER}/child.html`
      });

      // The method call message listener is set up after the connection has been established.
      connection.promise.then((child) => {
        connection.destroy();

        child.multiply().catch((error) => {
          expect(error).toEqual(jasmine.any(Error));
          expect(error.message).toBe('Unable to send multiply() call due to destroyed connection');
          done();
        });
      });
    });

    it('should support multiple connections', (done) => {
      const connection1 = Penpal.connectToChild({
        url: `${CHILD_SERVER}/child.html`
      });
      const connection2 = Penpal.connectToChild({
        url: `${CHILD_SERVER}/child.html`
      });

      RSVP.all([
        connection1.promise.then((child) => {
          return child.multiplyAsync(2, 5).then((value) => {
            expect(value).toEqual(10);
            connection1.destroy();
          });
        }),
        connection2.promise.then((child) => {
          return child.multiplyAsync(3, 5).then((value) => {
            expect(value).toEqual(15);
            connection2.destroy();
          });
        })
      ]).then(done);
    });
  });
});
