import { CHILD_SERVER } from './constants';

describe('connectToChild with iframe', () => {
  it('completes a handshake', done => {
    const iframeToUse = document.createElement('iframe');
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`,
      iframe: iframeToUse
    });

    connection.promise.then(() => {
      connection.destroy();
      done();
    });
  });

  it('adds the iframe to document.body', () => {
    const iframeToUse = document.createElement('iframe');
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`,
      iframe: iframeToUse
    });

    expect(connection.iframe).toBe(iframeToUse);
    expect(connection.iframe.src).toBe(`${CHILD_SERVER}/child.html`);
    expect(connection.iframe.parentNode).toBe(document.body);
  });

  it('overrides the iframe source with the url parameter', () => {
    const iframeToUse = document.createElement('iframe');
    iframeToUse.src = './to_be_override.html';
    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`,
      iframe: iframeToUse
    });

    expect(connection.iframe).toBe(iframeToUse);
    expect(connection.iframe.src).toBe(`${CHILD_SERVER}/child.html`);
  });

  it('adds the iframe to a specific element', () => {
    const container = document.createElement('div');
    const iframeToUse = document.createElement('iframe');
    document.body.appendChild(container);

    const connection = Penpal.connectToChild({
      src: `${CHILD_SERVER}/child.html`,
      appendTo: container,
      iframe: iframeToUse
    });

    expect(connection.iframe).toBe(iframeToUse);
    expect(connection.iframe.src).toBe(`${CHILD_SERVER}/child.html`);
    expect(connection.iframe.parentNode).toBe(container);
  });

  it('throws ERR_IFRAME_ALREADY_ATTACHED_TO_DOM error if the iframe is already attached to DOM', () => {
    const iframeToUse = document.createElement('iframe');
    document.body.appendChild(iframeToUse);

    let error;
    try {
      Penpal.connectToChild({
        src: `${CHILD_SERVER}/child.html`,
        iframe: iframeToUse
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe(Penpal.ERR_IFRAME_ALREADY_ATTACHED_TO_DOM);
  });
});
