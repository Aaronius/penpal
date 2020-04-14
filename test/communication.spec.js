import { CHILD_SERVER } from './constants';
import { createAndAddIframe } from './utils';

describe('communication between parent and child', () => {
  it('calls a function on the child', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`),
      debug: true
    });

    return connection.promise
      .then(child => {
        return child.multiply(2, 5);
      })
      .then(value => {
        expect(value).toEqual(10);
        connection.destroy();
      });
  });

  it('calls a function on the child with origin set', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/childOrigin.html`)
    });

    return connection.promise
      .then(child => {
        return child.multiply(2, 5);
      })
      .then(value => {
        expect(value).toEqual(10);
        connection.destroy();
      });
  });

  it('calls an asynchronous function on the child', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    return connection.promise
      .then(child => {
        return child.multiplyAsync(2, 5);
      })
      .then(value => {
        expect(value).toEqual(10);
        connection.destroy();
      });
  });

  it('calls a function on the parent', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`),
      methods: {
        add: (num1, num2) => {
          return num1 + num2;
        }
      }
    });

    return connection.promise.then(child => {
      return child
        .addUsingParent()
        .then(() => {
          return child.getParentReturnValue();
        })
        .then(value => {
          expect(value).toEqual(9);
          connection.destroy();
        });
    });
  });

  it('handles promises rejected with strings', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    return connection.promise
      .then(child => {
        return child.getRejectedPromiseString();
      })
      .catch(error => {
        expect(error).toBe('test error string');
        connection.destroy();
      });
  });

  it('handles promises rejected with error objects', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    return connection.promise
      .then(child => {
        return child.getRejectedPromiseError();
      })
      .catch(error => {
        expect(error).toEqual(jasmine.any(Error));
        expect(error.name).toBe('TypeError');
        expect(error.message).toBe('test error object');
        // In IE, errors only get `stack` set when an error is raised. In this test case, the
        // promise rejected with the error and never raised, so no stack.
        // expect(error.stack).toEqual(jasmine.any(String));
        connection.destroy();
      });
  });

  it('handles thrown errors', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    return connection.promise
      .then(child => {
        return child.throwError();
      })
      .catch(error => {
        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toBe('Oh nos!');
        connection.destroy();
      });
  });

  it('handles unclonable values', () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/child.html`)
    });

    return connection.promise
      .then(child => {
        return child.getUnclonableValue();
      })
      .catch(error => {
        expect(error).toEqual(jasmine.any(Error));
        expect(error.name).toBe('DataCloneError');
        connection.destroy();
      });
  });
});
