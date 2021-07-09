import { CHILD_SERVER } from './constants';
import { createAndAddIframe } from './utils';

describe('communication between parent and child', () => {
  it('calls a function on the child', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
      debug: true,
    });
    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.destroy();
  });

  it('calls a function on the child with matching parentOrigin set', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/matchingParentOrigin.html`),
    });
    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.destroy();
  });

  it('calls an asynchronous function on the child', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });
    const child = await connection.promise;
    const value = await child.multiply(2, 5);
    expect(value).toEqual(10);
    connection.destroy();
  });

  it('calls a function on the parent', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
      methods: {
        add: (num1, num2) => {
          return num1 + num2;
        },
      },
    });
    const child = await connection.promise;
    await child.addUsingParent();
    const value = await child.getParentReturnValue();
    expect(value).toEqual(9);
    connection.destroy();
  });

  it('handles promises rejected with strings', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });
    const child = await connection.promise;
    await expectAsync(child.getRejectedPromiseString()).toBeRejectedWith(
      'test error string'
    );
    connection.destroy();
  });

  it('handles promises rejected with error objects', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });
    const child = await connection.promise;
    let error;
    try {
      await child.getRejectedPromiseError();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect(error.name).toBe('TypeError');
    expect(error.message).toBe('test error object');
    // In IE, errors only get `stack` set when an error is raised. In this test case, the
    // promise rejected with the error and never raised, so no stack.
    // expect(error.stack).toEqual(jasmine.any(String));
    connection.destroy();
  });

  it('handles thrown errors', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });
    const child = await connection.promise;
    let error;
    try {
      await child.throwError();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect(error.message).toBe('Oh nos!');
    connection.destroy();
  });

  it('handles unclonable values', async () => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });
    const child = await connection.promise;
    let error;
    try {
      await child.getUnclonableValue();
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect(error.name).toBe('DataCloneError');
    connection.destroy();
  });
});
