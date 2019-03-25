import { CHILD_SERVER } from './constants';

describe('connectToChild without iframe', () => {
  it('completes a handshake', done => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    connection.promise.then(() => {
      connection.destroy();
      done();
    });
  });

  it('creates an iframe and adds it to document.body', () => {
    const connection = Penpal.connectToChild({
      url: `${CHILD_SERVER}/child.html`
    });

    expect(connection.iframe).toBeDefined();
    expect(connection.iframe.src).toBe(`${CHILD_SERVER}/child.html`);
    expect(connection.iframe.parentNode).toBe(document.body);
  });

  it('creates an iframe and adds it to a specific element', () => {
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
});
