import { HANDSHAKE, HANDSHAKE_REPLY, MESSAGE } from './constants';
import {
  ERR_CONNECTION_DESTROYED,
  ERR_CONNECTION_TIMEOUT,
  ERR_NOT_IN_IFRAME
} from './errorCodes';
import createDestructor from './createDestructor';
import connectCallReceiver from './connectCallReceiver';
import connectCallSender from './connectCallSender';
import createLogger from './createLogger';

/**
 * @typedef {Object} Parent
 * @property {Promise} promise A promise which will be resolved once a connection has
 * been established.
 * @property {Function} destroy A method that, when called, will disconnect any
 * messaging channels. You may call this even before a connection has been established.
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
export default ({ parentOrigin = '*', methods = {}, timeout, debug } = {}) => {
  const log = createLogger(debug);

  if (window === window.top) {
    const error = new Error(
      'connectToParent() must be called within an iframe'
    );
    error.code = ERR_NOT_IN_IFRAME;
    throw error;
  }

  const { destroy, onDestroy } = createDestructor();

  const child = window;
  const parent = child.parent;

  let parentOriginResolve;
  const parentOriginPromise = new Promise(
    resolve => (parentOriginResolve = resolve)
  );

  const promise = new Promise((resolveConnectionPromise, reject) => {
    let connectionTimeoutId;

    if (timeout !== undefined) {
      connectionTimeoutId = setTimeout(() => {
        const error = new Error(
          `Connection to parent timed out after ${timeout}ms`
        );
        error.code = ERR_CONNECTION_TIMEOUT;
        reject(error);
        destroy();
      }, timeout);
    }

    const handleMessageEvent = event => {
      // Under niche scenarios, we get into this function after
      // the iframe has been removed from the DOM. In Edge, this
      // results in "Object expected" errors being thrown when we
      // try to access properties on window (global properties).
      // For this reason, we try to access a global up front (clearTimeout)
      // and if it fails we can assume the iframe has been removed
      // and we ignore the message event.
      try {
        clearTimeout();
      } catch (e) {
        return;
      }

      if (event.source !== parent || event.data.penpal !== HANDSHAKE_REPLY) {
        return;
      }

      if (parentOrigin !== '*' && parentOrigin !== event.origin) {
        log(
          `Child received handshake reply from origin ${
            event.origin
          } which did not match expected origin ${parentOrigin}`
        );
        return;
      }

      log('Child: Received handshake reply');

      child.removeEventListener(MESSAGE, handleMessageEvent);

      const info = {
        localName: 'Child',
        local: child,
        remote: parent,
        originForSending: event.origin === 'null' ? '*' : event.origin,
        originForReceiving: event.origin
      };

      const callSender = {};

      const destroyCallReceiver = connectCallReceiver(info, methods, log);

      onDestroy(destroyCallReceiver);

      const destroyCallSender = connectCallSender(
        callSender,
        info,
        event.data.methodNames,
        destroy,
        log
      );

      onDestroy(destroyCallSender);

      clearTimeout(connectionTimeoutId);
      resolveConnectionPromise(callSender);
      parentOriginResolve(event.origin);
    };

    child.addEventListener(MESSAGE, handleMessageEvent);

    onDestroy(() => {
      child.removeEventListener(MESSAGE, handleMessageEvent);

      const error = new Error('Connection destroyed');
      error.code = ERR_CONNECTION_DESTROYED;
      reject(error);
    });

    log('Child: Sending handshake');

    parent.postMessage(
      {
        penpal: HANDSHAKE,
        methodNames: Object.keys(methods)
      },
      parentOrigin
    );
  });

  return {
    promise,
    parentOriginPromise,
    destroy
  };
};
