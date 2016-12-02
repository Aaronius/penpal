const PARENT = 'parent';
const CHILD = 'child';
const HANDSHAKE = 'handshake';
const HANDSHAKE_REPLY = 'handshake-reply';
const CALL = 'call';
const REPLY = 'reply';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';
const MESSAGE = 'message';

const Penpal = {
  /**
   * Promise implementation.
   * @type {Constructor}
   */
  Promise: (() => {
    try {
      return window ? window.Promise : null;
    } catch (e) {
      return null;
    }
  })(),
  /**
   * Whether debug messages should be logged.
   * @type {boolean}
   */
  debug: false
};

/**
 * @return {number} A unique ID (not universally unique)
 */
const generateId = (() => {
  let id = 0;
  return () => ++id;
})();

/**
 * Logs a message.
 * @param {...*} args One or more items to log
 */
function log(...args) {
  if (Penpal.debug) {
    console.log('[Penpal]', ...args); // eslint-disable-line no-console
  }
}

/**
 * Converts a URL into an origin.
 * @param {string} url
 * @return {string} The URL's origin
 */
function getOriginFromUrl(url) {
  const location = document.location;
  const a = document.createElement('a');
  a.href = url;

  return a.origin ||
    `${a.protocol || location.protocol}//${a.hostname || location.hostname}:${a.port || location.port}`;
}

/**
 * Creates an object with methods that match those defined by the remote. When these methods are
 * called, a "call" message will be sent to the remote, the remote's corresponding method will be
 * executed, and the method's return value will be returned via a message.
 * @param {Object} info Information about the local and remote windows.
 * @param {Array} methodNames Names of methods available to be called on the remote.
 * @returns {Object} An object with methods that may be called.
 */
function createCallSender(info, methodNames) {
  const { localName, local, remote, remoteOrigin } = info;

  log(`${localName}: Creating call sender`);

  const createMethodProxy = (methodName) => {
    return (...args) => {
      log(`${localName}: Sending ${methodName}() call`);
      return new Penpal.Promise((resolve, reject) => {
        const id = generateId();
        const handleMessageEvent = (event) => {
          if (event.source === remote &&
              event.origin === remoteOrigin &&
              event.data.penpal === REPLY &&
              event.data.id === id) {
            log(`${localName}: Received ${methodName}() reply`);
            local.removeEventListener(MESSAGE, handleMessageEvent);
            (event.data.resolution === FULFILLED ? resolve : reject)(event.data.returnValue);
          }
        };

        local.addEventListener(MESSAGE, handleMessageEvent);
        remote.postMessage({
          penpal: CALL,
          id,
          methodName,
          args
        }, remoteOrigin);
      });
    };
  };

  return methodNames.reduce((api, methodName) => {
    api[methodName] = createMethodProxy(methodName);
    return api;
  }, {});
}

/**
 * Listens for "call" messages coming from the remote, executes the corresponding method, and
 * responds with the return value.
 * @param {Object} info Information about the local and remote windows.
 * @param {Object} methods The keys are the names of the methods that can be called by the remote
 * while the values are the method functions.
 * @returns {Function} A function that may be called to disconnect the receiver.
 */
function connectCallReceiver(info, methods) {
  const { localName, local, remote, remoteOrigin } = info;

  log(`${localName}: Connecting call receiver`);

  const handleMessageEvent = (event) => {
    if (event.source === remote &&
        event.origin === remoteOrigin &&
        event.data.penpal === CALL) {
      const { methodName, args, id } = event.data;

      log(`${localName}: Received ${methodName}() call`);

      if (methodName in methods) {
        const createPromiseHandler = (resolution) => {
          return (returnValue) => {
            log(`${localName}: Sending ${methodName}() reply`);

            remote.postMessage({
              penpal: REPLY,
              id,
              resolution,
              returnValue,
            }, remoteOrigin);
          }
        };

        Penpal.Promise.resolve(methods[methodName](...args)).then(
          createPromiseHandler(FULFILLED),
          createPromiseHandler(REJECTED)
        );
      }
    }
  };

  local.addEventListener(MESSAGE, handleMessageEvent);

  log(`${localName}: Awaiting calls...`);

  return () => {
    local.removeEventListener(MESSAGE, handleMessageEvent);
  };
}

/**
 * @typedef {Object} Child
 * @property {Promise} promise A promise which will be resolved once a connection has
 * been established.
 * @property {HTMLIframeElement} iframe The created iframe element.
 * @property {Function} destroy A method that, when called, will remove the iframe element from
 * the DOM and clean up event listeners.
 */

/**
 * Creates an iframe, loads a webpage into the URL, and attempts to establish communication with
 * the iframe.
 * @param {Object} options
 * @param {string} options.url The URL of the webpage that should be loaded into the created iframe.
 * @param {HTMLElement} [options.appendTo] The container to which the iframe should be appended.
 * @param {Object} [options.methods] Methods that may be called by the iframe.
 * @return {Child}
 */
Penpal.connectToChild = ({ url, appendTo, methods = {} }) => {
  const parent = window;
  const iframe = document.createElement('iframe');
  (appendTo || document.body).appendChild(iframe);
  const child = iframe.contentWindow || iframe.contentDocument.parentWindow;
  const childOrigin = getOriginFromUrl(url);
  let handleMessageEvent;
  let disconnectReceiver;

  const promise = new Penpal.Promise((resolve) => {
    handleMessageEvent = (event) => {
      if (event.source === child &&
          event.origin === childOrigin &&
          event.data.penpal === HANDSHAKE_REPLY) {
        log('Parent: Received handshake reply from Child');

        parent.removeEventListener(MESSAGE, handleMessageEvent);

        const info = {
          localName: PARENT,
          local: parent,
          remote: child,
          remoteOrigin: event.origin
        };

        disconnectReceiver = connectCallReceiver(info, methods);
        resolve(createCallSender(info, event.data.methodNames));
      }
    };

    parent.addEventListener(MESSAGE, handleMessageEvent);

    iframe.addEventListener('load', () => {
      log('Parent: Sending handshake');

      setTimeout(() => {
        child.postMessage({
          penpal: HANDSHAKE,
          methodNames: Object.keys(methods)
        }, childOrigin);
      });
    });

    log('Parent: Loading iframe');

    iframe.src = url;
  });

  const destroy = () => {
    parent.removeEventListener(MESSAGE, handleMessageEvent);

    if (disconnectReceiver) {
      disconnectReceiver();
    }

    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  return {
    promise,
    iframe,
    destroy
  };
};

/**
 * @typedef {Object} Parent
 * @property {Promise} promise A promise which will be resolved once a connection has
 * been established.
 */

/**
 * Attempts to establish communication with the parent window.
 * @param {Object} options
 * @param {string} [options.parentOrigin] A parent origin used to restrict communication.
 * @param {Object} [options.methods] Methods that may be called by the parent window.
 * @return {Parent}
 */
Penpal.connectToParent = ({ parentOrigin, methods = {} }) => {
  const child = window;
  const parent = child.parent;

  const promise = new Penpal.Promise((resolve) => {
    const handleMessageEvent = (event) => {
      if ((!parentOrigin || event.origin === parentOrigin) &&
          event.data.penpal === HANDSHAKE) {
        log('Child: Received handshake from Parent');

        child.removeEventListener(MESSAGE, handleMessageEvent);

        log('Child: Sending handshake reply to Parent');

        event.source.postMessage({
          penpal: HANDSHAKE_REPLY,
          methodNames: Object.keys(methods)
        }, event.origin);

        const info = {
          localName: CHILD,
          local: child,
          remote: parent,
          remoteOrigin: event.origin
        };

        connectCallReceiver(info, methods);

        resolve(createCallSender(info, event.data.methodNames));
      }
    };

    child.addEventListener(MESSAGE, handleMessageEvent);
  });

  return {
    promise
  };
};

export default Penpal;
