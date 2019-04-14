import { CHILD_SERVER } from './constants';

describe('communication between parent and child', () => {
  it('calls a function on the child', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(child => {
      child.multiply(2, 5).then(value => {
        expect(value).toEqual(10);
        connection.destroy();
        done();
      });
    });
  });

  it('calls a function on the child with origin set', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/childOrigin.html`
    });

    connection.promise.then(child => {
      child.multiply(2, 5).then(value => {
        expect(value).toEqual(10);
        connection.destroy();
        done();
      });
    });
  });

  it('calls an asynchronous function on the child', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(child => {
      child.multiplyAsync(2, 5).then(value => {
        expect(value).toEqual(10);
        connection.destroy();
        done();
      });
    });
  });

  it('calls a function on the parent', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`,
      methods: {
        add: (num1, num2) => {
          return num1 + num2;
        }
      }
    });

    connection.promise.then(child => {
      child.addUsingParent().then(() => {
        child.getParentReturnValue().then(value => {
          expect(value).toEqual(9);
          connection.destroy();
          done();
        });
      });
    });
  });

  it('handles promises rejected with strings', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(child => {
      child.getRejectedPromiseString().catch(error => {
        expect(error).toBe('test error string');
        connection.destroy();
        done();
      });
    });
  });

  it('handles promises rejected with error objects', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(child => {
      child.getRejectedPromiseError().catch(error => {
        expect(error).toEqual(jasmine.any(Error));
        expect(error.name).toBe('TypeError');
        expect(error.message).toBe('test error object');
        // In IE, errors only get `stack` set when an error is raised. In this test case, the
        // promise rejected with the error and never raised, so no stack.
        // expect(error.stack).toEqual(jasmine.any(String));
        connection.destroy();
        done();
      });
    });
  });

  it('handles thrown errors', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(child => {
      child.throwError().catch(error => {
        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toBe('Oh nos!');
        connection.destroy();
        done();
      });
    });
  });

  it('handles unclonable values', done => {
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(child => {
      child.getUnclonableValue().catch(error => {
        expect(error).toEqual(jasmine.any(Error));
        expect(error.name).toBe('DataCloneError');
        connection.destroy();
        done();
      });
    });
  });
});
