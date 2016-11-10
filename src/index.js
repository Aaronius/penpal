const PenPal = {
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
  if (PenPal.debug) {
    console.log('[PenPal]', ...args); // eslint-disable-line no-console
  }
}

/**
 * Converts a URL into an origin.
 * @param {string} url
 * @return {string} The URL's origin
 */
function getOriginFromUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  return a.origin ||
    (a.protocol || document.location.protocol) + '//' + a.hostname + (a.port ? ':' + a.port : '');
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
      return new PenPal.Promise((resolve) => {
        const id = generateId();
        const handleMessageEvent = (event) => {
          if (event.source === remote &&
              event.origin === remoteOrigin &&
              event.data.penpal === 'reply' &&
              event.data.id === id) {
            log(`${localName}: Received ${methodName}() reply`);
            local.removeEventListener('message', handleMessageEvent);
            resolve(event.data.returnValue);
          }
        };

        local.addEventListener('message', handleMessageEvent);
        remote.postMessage({
          penpal: 'call',
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
        event.data.penpal === 'call') {
      const { methodName, args, id } = event.data;

      log(`${localName}: Received ${methodName}() call`);

      if (methodName in methods) {
        PenPal.Promise.resolve(methods[methodName](...args)).then((returnValue) => {
          log(`${localName}: Sending ${methodName}() reply`);

          remote.postMessage({
            penpal: 'reply',
            id,
            returnValue,
          }, remoteOrigin);
        });
      }
    }
  };

  local.addEventListener('message', handleMessageEvent);

  log(`${localName}: Awaiting calls...`);

  return () => {
    local.removeEventListener('message', handleMessageEvent);
  };
}

/**
 * Creates an iframe, loads a webpage into the URL, and attempts to establish communication with
 * the iframe.
 * @param {Object} options
 * @param {string} options.url The URL of the webpage that should be loaded into the created iframe.
 * @param {HTMLElement} [options.appendTo] The container to which the iframe should be appended.
 * @param {Object} [options.methods] Methods that may be called by the iframe.
 * @type {Promise} A promise which will be resolved once a connection has been established.
 */
PenPal.connectToChild = ({ url, appendTo, methods = {} }) => {
  const parent = window;
  const iframe = document.createElement('iframe');
  (appendTo || document.body).appendChild(iframe);
  const child = iframe.contentWindow || iframe.contentDocument.parentWindow;
  const childOrigin = getOriginFromUrl(url);

  return new PenPal.Promise((resolve) => {
    const handleMessageEvent = (event) => {
      if (event.source === child &&
          event.origin === childOrigin &&
          event.data.penpal === 'handshake-reply') {
        log('Parent: Received handshake reply from Child');

        parent.removeEventListener('message', handleMessageEvent);

        const info = {
          localName: 'Parent',
          local: parent,
          remote: child,
          remoteOrigin: event.origin
        };

        const disconnectReceiver = connectCallReceiver(info, methods);
        const api = createCallSender(info, event.data.methodNames);

        api.iframe = iframe;

        api.destroy = () => {
          disconnectReceiver();
          iframe.parentNode.removeChild(iframe);
        };

        resolve(api);
      }
    };

    parent.addEventListener('message', handleMessageEvent);

    iframe.addEventListener('load', () => {
      log('Parent: Sending handshake');

      setTimeout(() => {
        child.postMessage({
          penpal: 'handshake',
          methodNames: Object.keys(methods)
        }, childOrigin);
      });
    });

    log('Parent: Loading iframe');

    iframe.src = url;
  });
};

/**
 * Attempts to establish communication with the parent window.
 * @param {Object} options
 * @param {string} [options.parentOrigin] A parent origin used to restrict communication.
 * @param {Object} [options.methods] Methods that may be called by the parent window.
 * @type {Promise} A promise which will be resolved once a connection has been established.
 */
PenPal.connectToParent = ({ parentOrigin, methods = {} }) => {
  const child = window;
  const parent = child.parent;

  return new PenPal.Promise((resolve) => {
    const handleMessageEvent = (event) => {
      if ((!parentOrigin || event.origin === parentOrigin) &&
          event.data.penpal === 'handshake') {
        log('Child: Received handshake from Parent');

        child.removeEventListener('message', handleMessageEvent);

        log('Child: Sending handshake reply to Parent');

        event.source.postMessage({
          penpal: 'handshake-reply',
          methodNames: Object.keys(methods)
        }, event.origin);

        const info = {
          localName: 'Child',
          local: child,
          remote: parent,
          remoteOrigin: event.origin
        };

        connectCallReceiver(info, methods);

        resolve(createCallSender(info, event.data.methodNames));
      }
    };

    child.addEventListener('message', handleMessageEvent);
  });
};

export default PenPal;
