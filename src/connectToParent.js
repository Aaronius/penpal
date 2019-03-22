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
      if (
        (parentOrigin === '*' || parentOrigin === event.origin) &&
        event.source === parent &&
        event.data.penpal === HANDSHAKE_REPLY
      ) {
        log('Child: Received handshake reply');

        child.removeEventListener(MESSAGE, handleMessageEvent);

        const info = {
          localName: 'Child',
          local: child,
          remote: parent,
          remoteOrigin: event.origin
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
      }
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
    destroy
  };
};
