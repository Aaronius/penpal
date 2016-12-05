const HOST = 'localhost';

describe('Penpal', () => {
  beforeAll(() => {
    Penpal.Promise = RSVP.Promise;
    Penpal.debug = true;
  });

  it('should complete a handshake', (done) => {
    const connection = Penpal.connectToChild({
      url: `http://${HOST}:9000/child.html`
    });

    connection.promise.then(() => {
      connection.destroy();
      done();
    });
  });

  it('should create an iframe and add it to document.body', () => {
    const connection = Penpal.connectToChild({
      url: `http://${HOST}:9000/child.html`
    });

    expect(connection.iframe).toBeDefined();
    expect(connection.iframe.src).toBe(`http://${HOST}:9000/child.html`);
    expect(connection.iframe.parentNode).toBe(document.body);
  });

  it('should create an iframe and add it to a specific element', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const connection = Penpal.connectToChild({
      url: `http://${HOST}:9000/child.html`,
      appendTo: container
    });

    expect(connection.iframe).toBeDefined();
    expect(connection.iframe.src).toBe(`http://${HOST}:9000/child.html`);
    expect(connection.iframe.parentNode).toBe(container);
  });

  it('should call a function on the child', (done) => {
    const connection = Penpal.connectToChild({
      url: `http://${HOST}:9000/child.html`
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
      url: `http://${HOST}:9000/child.html`
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
      url: `http://${HOST}:9000/child.html`,
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
      url: `http://${HOST}:9000/child.html`,
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
    })
  });

  it('should not connect to iframe connecting to parent with different origin', (done) => {
    const connection = Penpal.connectToChild({
      url: `http://${HOST}:9000/childDiffOrigin.html`
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

  describe('destroy', () => {
    it('should remove iframe from its parent', (done) => {
      const connection = Penpal.connectToChild({
        url: `http://${HOST}:9000/child.html`
      });

      connection.destroy();

      expect(connection.iframe.parentNode).toBeNull();
      done();
    });

    it('should reject promise', (done) => {
      const connection = Penpal.connectToChild({
        url: `http://${HOST}:9000/child.html`
      });

      const onRejected = jasmine.createSpy();

      connection.promise.then(
        () => {},
        onRejected
      );

      connection.destroy();

      setTimeout(() => {
        expect(onRejected).toHaveBeenCalledWith('Parent: Connection destroyed');
        done();
      });
    });

    // When this test runs in IE, we get an "Object Expected" error within the iframe due to the
    // Array constructor not existing. It appears that when we call connection.destroy(), which
    // removes the iframe, IE messes up the Array constructor within the detached iframe.
    it('should remove handshake message listener', (done) => {
      spyOn(window, 'addEventListener').and.callThrough();
      spyOn(window, 'removeEventListener').and.callThrough();

      const connection = Penpal.connectToChild({
        url: `http://${HOST}:9000/child.html`
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
        url: `http://${HOST}:9000/child.html`
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
        url: `http://${HOST}:9000/child.html`
      });

      // The method call message listener is set up after the connection has been established.
      connection.promise.then((child) => {
        connection.destroy();

        child.multiply().catch((error) => {
          expect(error).toBe('Unable to send multiply() call due to destroyed connection');
          done();
        });
      });
    });

    // Had trouble implementing this one.
    // it('should prevent method replies from being sent', () => {
    // });
  });
});
