import { HANDSHAKE, HANDSHAKE_REPLY, MESSAGE } from './constants';
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NO_IFRAME_SRC
} from './errorCodes';
import createDestructor from './createDestructor';
import getOriginFromSrc from './getOriginFromSrc';
import createLogger from './createLogger';
import connectCallReceiver from './connectCallReceiver';
import connectCallSender from './connectCallSender';

const CHECK_IFRAME_IN_DOC_INTERVAL = 60000;

/**
 * @typedef {Object} Child
 * @property {Promise} promise A promise which will be resolved once a connection has
 * been established.
 * @property {Function} destroy A method that, when called, will disconnect any
 * messaging channels. You may call this even before a connection has been established.
 */

/**
 * Creates an iframe, loads a webpage into the URL, and attempts to establish communication with
 * the iframe.
 * @param {Object} options
 * @param {HTMLIframeElement} options.iframe The iframe to connect to.
 * @param {Object} [options.methods={}] Methods that may be called by the iframe.
 * @param {String} [options.childOrigin] The child origin to use to secure communication. If
 * not provided, the child origin will be derived from the iframe's src or srcdoc value.
 * @param {Number} [options.timeout] The amount of time, in milliseconds, Penpal should wait
 * for the child to respond before rejecting the connection promise.
 * @return {Child}
 */
export default ({ iframe, methods = {}, childOrigin, timeout, debug }) => {
  const log = createLogger(debug);
  const parent = window;
  const { destroy, onDestroy } = createDestructor();

  if (!childOrigin) {
    if (!iframe.src && !iframe.srcdoc) {
      const error = new Error(
        'Iframe must have src or srcdoc property defined.'
      );
      error.code = ERR_NO_IFRAME_SRC;
      throw error;
    }

    childOrigin = getOriginFromSrc(iframe.src);
  }

  // If event.origin is "null", the remote protocol is
  // file:, data:, and we must post messages with "*" as targetOrigin
  // when sending and allow
  // [1] https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage#Utiliser_window.postMessage_dans_les_extensions
  const originForSending = childOrigin === 'null' ? '*' : childOrigin;

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

      if (event.source !== child || event.data.penpal !== HANDSHAKE) {
        return;
      }

      if (event.origin !== childOrigin) {
        log(
          `Parent received handshake from origin ${
            event.origin
          } which did not match expected origin ${childOrigin}`
        );
        return;
      }

      log('Parent: Received handshake, sending reply');

      event.source.postMessage(
        {
          penpal: HANDSHAKE_REPLY,
          methodNames: Object.keys(methods)
        },
        originForSending
      );

      const info = {
        localName: 'Parent',
        local: parent,
        remote: child,
        originForSending: originForSending,
        originForReceiving: childOrigin
      };

      // If the child reconnected, we need to destroy the previous call receiver before setting
      // up a new one.
      if (destroyCallReceiver) {
        destroyCallReceiver();
      }

      destroyCallReceiver = connectCallReceiver(info, methods, log);

      onDestroy(destroyCallReceiver);

      // If the child reconnected, we need to remove the methods from the previous call receiver
      // off the sender.
      if (receiverMethodNames) {
        receiverMethodNames.forEach(receiverMethodName => {
          delete callSender[receiverMethodName];
        });
      }

      receiverMethodNames = event.data.methodNames;
      const destroyCallSender = connectCallSender(
        callSender,
        info,
        receiverMethodNames,
        destroy,
        log
      );

      onDestroy(destroyCallSender);

      clearTimeout(connectionTimeoutId);
      resolveConnectionPromise(callSender);
    };

    parent.addEventListener(MESSAGE, handleMessage);

    log('Parent: Awaiting handshake');

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

    onDestroy(() => {
      parent.removeEventListener(MESSAGE, handleMessage);
      clearInterval(checkIframeInDocIntervalId);

      const error = new Error('Connection destroyed');
      error.code = ERR_CONNECTION_DESTROYED;
      reject(error);
    });
  });

  return {
    promise,
    destroy
  };
};
