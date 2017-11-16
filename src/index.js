const HANDSHAKE = 'handshake';
const HANDSHAKE_REPLY = 'handshake-reply';
const CALL = 'call';
const REPLY = 'reply';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';
const MESSAGE = 'message';
const DATA_CLONE_ERROR = 'DataCloneError';

const DEFAULT_PORTS = {
  'http:': '80',
  'https:': '443'
};

const URL_REGEX = /^(https?:)?\/\/([^\/:]+)(:(\d+))?/;

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
const log = (...args) => {
  if (Penpal.debug) {
    console.log('[Penpal]', ...args); // eslint-disable-line no-console
  }
};

/**
 * Converts a URL into an origin.
 * @param {string} url
 * @return {string} The URL's origin
 */
const getOriginFromUrl = (url) => {
  const location = document.location;

  const regexResult = URL_REGEX.exec(url);
  let protocol;
  let hostname;
  let port;

  if (regexResult) { // It's an absolute URL. Use the parsed info.
    // regexResult[1] will be undefined if the URL starts with //
    protocol = regexResult[1] ? regexResult[1] : location.protocol;
    hostname = regexResult[2];
    port = regexResult[4];
  } else { // It's a relative path. Use the current location's info.
    protocol = location.protocol;
    hostname = location.hostname;
    port = location.port;
  }

  // If the port is the default for the protocol, we don't want to add it to the origin string
  // or it won't match the message's event.origin.
  return protocol + '//' + hostname +
    (port && port !== DEFAULT_PORTS[protocol] ? ':' + port : '');
};

/**
 * A simplified promise class only used internally for when destroy() is called. This is
 * used to destroy connections synchronously while promises typically resolve asynchronously.
 *
 * @param {Function} executor
 * @returns {Object}
 * @constructor
 */
const DestructionPromise = (executor) => {
  const handlers = [];

  executor(() => {
    handlers.forEach((handler) => {
      handler();
    })
  });

  return {
    then(handler) {
      handlers.push(handler);
    }
  }
};

/**
 * Converts an error object into a plain object.
 * @param {Error} Error object.
 * @returns {Object}
 */
const serializeError = ({ name, message, stack }) => ({ name, message, stack });

/**
 * Converts a plain object into an error object.
 * @param {Object} Object with error properties.
 * @returns {Error}
 */
const deserializeError = (obj) => {
  const deserializedError = new Error();
  Object.keys(obj).forEach(key => deserializedError[key] = obj[key]);
  return deserializedError;
};

/**
 * Augments an object with methods that match those defined by the remote. When these methods are
 * called, a "call" message will be sent to the remote, the remote's corresponding method will be
 * executed, and the method's return value will be returned via a message.
 * @param {Object} callSender Sender object that should be augmented with methods.
 * @param {Object} info Information about the local and remote windows.
 * @param {Array} methodNames Names of methods available to be called on the remote.
 * @param {Promise} destructionPromise A promise resolved when destroy() is called on the penpal
 * connection.
 * @returns {Object} The call sender object with methods that may be called.
 */
const connectCallSender = (callSender, info, methodNames, destructionPromise) => {
  const { localName, local, remote, remoteOrigin } = info;
  let destroyed = false;

  log(`${localName}: Connecting call sender`);

  const createMethodProxy = (methodName) => {
    return (...args) => {
      log(`${localName}: Sending ${methodName}() call`);
      return new Penpal.Promise((resolve, reject) => {
        if (destroyed) {
          reject(new Error(`Unable to send ${methodName}() call due to destroyed connection`));
          return;
        }

        const id = generateId();
        const handleMessageEvent = (event) => {
          if (event.source === remote &&
              event.origin === remoteOrigin &&
              event.data.penpal === REPLY &&
              event.data.id === id) {
            log(`${localName}: Received ${methodName}() reply`);
            local.removeEventListener(MESSAGE, handleMessageEvent);

            let returnValue = event.data.returnValue;

            if (event.data.returnValueIsError) {
              returnValue = deserializeError(returnValue);
            }

            (event.data.resolution === FULFILLED ? resolve : reject)(returnValue);
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

  destructionPromise.then(() => {
    destroyed = true;
  });

  methodNames.reduce((api, methodName) => {
    api[methodName] = createMethodProxy(methodName);
    return api;
  }, callSender);
};

/**
 * Listens for "call" messages coming from the remote, executes the corresponding method, and
 * responds with the return value.
 * @param {Object} info Information about the local and remote windows.
 * @param {Object} methods The keys are the names of the methods that can be called by the remote
 * while the values are the method functions.
 * @param {Promise} destructionPromise A promise resolved when destroy() is called on the penpal
 * connection.
 * @returns {Function} A function that may be called to disconnect the receiver.
 */
const connectCallReceiver = (info, methods, destructionPromise) => {
  const { localName, local, remote, remoteOrigin } = info;
  let destroyed = false;

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
            if (destroyed) {
              throw new Error(`Unable to send ${methodName}() reply due to destroyed connection`);
              return;
            }

            log(`${localName}: Sending ${methodName}() reply`);

            const message = {
              penpal: REPLY,
              id,
              resolution,
              returnValue,
            };

            if (resolution === REJECTED && returnValue instanceof Error) {
              message.returnValue = serializeError(returnValue);
              message.returnValueIsError = true;
            }

            try {
              remote.postMessage(message, remoteOrigin);
            } catch (err) {
              // If a consumer attempts to send an object that's not cloneable (e.g., window),
              // we want to ensure the receiver's promise gets rejected.
              if (err.name === DATA_CLONE_ERROR) {
                remote.postMessage({
                  penpal: REPLY,
                  id,
                  resolution: REJECTED,
                  returnValue: serializeError(err),
                  returnValueIsError: true
                }, remoteOrigin);
              }

              throw err;
            }
          }
        };

        new Penpal.Promise(resolve => resolve(methods[methodName](...args)))
          .then(createPromiseHandler(FULFILLED), createPromiseHandler(REJECTED));
      }
    }
  };

  local.addEventListener(MESSAGE, handleMessageEvent);

  destructionPromise.then(() => {
    destroyed = true;
    local.removeEventListener(MESSAGE, handleMessageEvent);
  });
};

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
 * @param {Object} [options.methods={}] Methods that may be called by the iframe.
 * @param {Number} [options.timeout] The amount of time, in milliseconds, Penpal should wait
 * for the child to respond before rejecting the connection promise.
 * @return {Child}
 */
Penpal.connectToChild = ({ url, appendTo, methods = {}, timeout }) => {
  let destroy;
  const destructionPromise = new DestructionPromise(resolve => destroy = resolve);

  const parent = window;
  const iframe = document.createElement('iframe');

  (appendTo || document.body).appendChild(iframe);

  destructionPromise.then(() => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  });

  const child = iframe.contentWindow || iframe.contentDocument.parentWindow;
  const childOrigin = getOriginFromUrl(url);
  const promise = new Penpal.Promise((resolve, reject) => {
    var timeoutId;

    if (timeout !== undefined) {
      timeoutId = setTimeout(() => {
        reject(new Error('Connection to child timed out after ' + timeout + 'ms'));
        destroy();
      }, timeout);
    }

    // We resolve the promise with the call sender. If the child reconnects (for example, after
    // refreshing or navigating to another page that uses Penpal, we'll update the call sender
    // with methods that match the latest provided by the child.
    const callSender = {};
    let methodNames;

    const handleMessage = (event) => {
      if (event.source === child &&
          event.origin === childOrigin &&
          event.data.penpal === HANDSHAKE) {
        log('Parent: Received handshake');
        log('Parent: Sending handshake reply');

        event.source.postMessage({
          penpal: HANDSHAKE_REPLY,
          methodNames: Object.keys(methods)
        }, event.origin);

        const info = {
          localName: 'Parent',
          local: parent,
          remote: child,
          remoteOrigin: event.origin
        };

        connectCallReceiver(info, methods, destructionPromise);

        // If we're reconnecting, remove methods from the previous connection.
        if (methodNames) {
          methodNames.forEach((methodName) => {
            delete callSender[methodName]
          });
        }

        methodNames = event.data.methodNames;
        connectCallSender(callSender, info, methodNames, destructionPromise);
        clearTimeout(timeoutId);
        resolve(callSender);
      }
    };

    parent.addEventListener(MESSAGE, handleMessage);
    destructionPromise.then(() => {
      parent.removeEventListener(MESSAGE, handleMessage);
      reject('Parent: Connection destroyed');
    });

    log('Parent: Loading iframe');
    iframe.src = url;
  });

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
 * @param {string} [options.parentOrigin=*] Valid parent origin used to restrict communication.
 * @param {Object} [options.methods={}] Methods that may be called by the parent window.
 * @param {Number} [options.timeout] The amount of time, in milliseconds, Penpal should wait
 * for the parent to respond before rejecting the connection promise.
 * @return {Parent}
 */
Penpal.connectToParent = ({ parentOrigin = '*', methods = {}, timeout }) => {
  if (window === window.top) {
    throw new Error('connectToParent() must be called within an iframe');
  }

  let destroy;
  const destructionPromise = new DestructionPromise(resolve => destroy = resolve);

  const child = window;
  const parent = child.parent;

  const promise = new Penpal.Promise((resolve, reject) => {
    var timeoutId;

    if (timeout !== undefined) {
      timeoutId = setTimeout(() => {
        reject(new Error('Connection to parent timed out after ' + timeout + 'ms'));
        destroy();
      }, timeout);
    }

    const handleMessageEvent = (event) => {
      if ((parentOrigin === '*' ||
          parentOrigin === event.origin) &&
          event.source === parent &&
          event.data.penpal === HANDSHAKE_REPLY) {
        log('Child: Received handshake reply');

        child.removeEventListener(MESSAGE, handleMessageEvent);

        const info = {
          localName: 'Child',
          local: child,
          remote: parent,
          remoteOrigin: event.origin
        };

        const callSender = {};

        connectCallReceiver(info, methods, destructionPromise);
        connectCallSender(callSender, info, event.data.methodNames, destructionPromise)
        clearTimeout(timeoutId);
        resolve(callSender);
      }
    };

    child.addEventListener(MESSAGE, handleMessageEvent);

    destructionPromise.then(() => {
      child.removeEventListener(MESSAGE, handleMessageEvent);
      reject(new Error('Child: Connection destroyed'));
    });

    log('Child: Sending handshake');

    parent.postMessage({
      penpal: HANDSHAKE,
      methodNames: Object.keys(methods),
    }, parentOrigin);
  });

  return {
    promise,
    destroy
  };
};

export default Penpal;
