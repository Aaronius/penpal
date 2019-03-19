import { HANDSHAKE, HANDSHAKE_REPLY, MESSAGE } from './constants';
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_IFRAME_ALREADY_ATTACHED_TO_DOM
} from './errorCodes';
import DestructionPromise from './destructionPromise';
import getOriginFromUrl from './getOriginFromUrl';
import createLogger from './createLogger';
import connectCallReceiver from './connectCallReceiver';
import connectCallSender from './connectCallSender';

const CHECK_IFRAME_IN_DOC_INTERVAL = 60000;

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
export default ({
  url,
  appendTo,
  iframe,
  methods = {},
  timeout,
  debug,
  Promise = window.Promise
}) => {
  const log = createLogger(debug);

  if (iframe && iframe.parentNode) {
    const error = new Error(
      'connectToChild() must not be called with an iframe already attached to DOM'
    );
    error.code = ERR_IFRAME_ALREADY_ATTACHED_TO_DOM;
    throw error;
  }

  let destroy;

  const connectionDestructionPromise = new DestructionPromise(
    resolveConnectionDestructionPromise => {
      destroy = resolveConnectionDestructionPromise;
    }
  );

  const parent = window;
  iframe = iframe || document.createElement('iframe');
  iframe.src = url;

  const childOrigin = getOriginFromUrl(url);

  const promise = new Promise((resolveConnectionPromise, reject) => {
    let connectionTimeoutId;

    if (timeout !== undefined) {
      connectionTimeoutId = setTimeout(() => {
        const error = new Error(
          `Connection to child timed out after ${timeout}ms`
        );
        error.code = ERR_CONNECTION_TIMEOUT;
        reject(error);
        destroy();
      }, timeout);
    }

    // We resolve the promise with the call sender. If the child reconnects (for example, after
    // refreshing or navigating to another page that uses Penpal, we'll update the call sender
    // with methods that match the latest provided by the child.
    const callSender = {};
    let receiverMethodNames;

    let destroyCallReceiver;

    const handleMessage = event => {
      const child = iframe.contentWindow;
      if (
        event.source === child &&
        event.origin === childOrigin &&
        event.data.penpal === HANDSHAKE
      ) {
        log('Parent: Received handshake, sending reply');

        // If event.origin is "null", the remote protocol is file:
        // and we must post messages with "*" as targetOrigin [1]
        // [1] https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage#Utiliser_window.postMessage_dans_les_extensions
        const remoteOrigin = event.origin === 'null' ? '*' : event.origin;

        event.source.postMessage(
          {
            penpal: HANDSHAKE_REPLY,
            methodNames: Object.keys(methods)
          },
          remoteOrigin
        );

        const info = {
          localName: 'Parent',
          local: parent,
          remote: child,
          remoteOrigin: remoteOrigin
        };

        // If the child reconnected, we need to destroy the previous call receiver before setting
        // up a new one.
        if (destroyCallReceiver) {
          destroyCallReceiver();
        }

        // When this promise is resolved, it will destroy the call receiver (stop listening to
        // method calls from the child) and delete its methods off the call sender.
        const callReceiverDestructionPromise = new DestructionPromise(
          resolveCallReceiverDestructionPromise => {
            connectionDestructionPromise.then(
              resolveCallReceiverDestructionPromise
            );
            destroyCallReceiver = resolveCallReceiverDestructionPromise;
          }
        );

        connectCallReceiver(info, methods, callReceiverDestructionPromise, log);

        // If the child reconnected, we need to remove the methods from the previous call receiver
        // off the sender.
        if (receiverMethodNames) {
          receiverMethodNames.forEach(receiverMethodName => {
            delete callSender[receiverMethodName];
          });
        }

        receiverMethodNames = event.data.methodNames;
        connectCallSender(
          callSender,
          info,
          receiverMethodNames,
          destroy,
          connectionDestructionPromise,
          log
        );
        clearTimeout(connectionTimeoutId);
        resolveConnectionPromise(callSender);
      }
    };

    parent.addEventListener(MESSAGE, handleMessage);

    log('Parent: Loading iframe');
    (appendTo || document.body).appendChild(iframe);

    // This is to prevent memory leaks when the iframe is removed
    // from the document and the consumer hasn't called destroy().
    // Without this, event listeners attached to the window would
    // stick around and since the event handlers have a reference
    // to the iframe in their closures, the iframe would stick around
    // too.
    var checkIframeInDocIntervalId = setInterval(() => {
      if (!document.contains(iframe)) {
        clearInterval(checkIframeInDocIntervalId);
        destroy();
      }
    }, CHECK_IFRAME_IN_DOC_INTERVAL);

    connectionDestructionPromise.then(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }

      parent.removeEventListener(MESSAGE, handleMessage);
      clearInterval(checkIframeInDocIntervalId);

      const error = new Error('Connection destroyed');
      error.code = ERR_CONNECTION_DESTROYED;
      reject(error);
    });
  });

  return {
    promise,
    iframe,
    destroy
  };
};
