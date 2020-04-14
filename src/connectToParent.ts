import createDestructor from './createDestructor';
import connectCallReceiver from './connectCallReceiver';
import connectCallSender from './connectCallSender';
import createLogger from './createLogger';
import {
  SynMessage,
  AckMessage,
  CallSender,
  Methods,
  PenpalError,
  WindowsInfo
} from './types';
import { ErrorCode, MessageType, NativeEventType } from './enums';

type Options = {
  parentOrigin?: string;
  methods?: Methods;
  timeout?: number;
  debug?: boolean;
};

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
export default (options: Options = {}) => {
  const { parentOrigin = '*', methods = {}, timeout, debug = false } = options;
  const log = createLogger(debug);

  if (window === window.top) {
    const error = new Error(
      'connectToParent() must be called within an iframe'
    ) as PenpalError;
    error.code = ErrorCode.NotInIframe;
    throw error;
  }

  const { destroy, onDestroy } = createDestructor();

  const child = window;
  const parent = child.parent;

  const promise = new Promise((resolve, reject) => {
    let connectionTimeoutId: number;

    if (timeout !== undefined) {
      connectionTimeoutId = window.setTimeout(() => {
        const error: PenpalError = new Error(
          `Connection to parent timed out after ${timeout}ms`
        ) as PenpalError;
        error.code = ErrorCode.ConnectionTimeout;
        reject(error);
        destroy();
      }, timeout);
    }

    const handleMessageEvent = (event: MessageEvent) => {
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

      if (event.source !== parent || event.data.penpal !== MessageType.SynAck) {
        return;
      }

      if (parentOrigin !== '*' && parentOrigin !== event.origin) {
        log(
          `Child: Handshake - Received SYN-ACK from origin ${
            event.origin
          } which did not match expected origin ${parentOrigin}`
        );
        return;
      }

      log('Child: Handshake - Received SYN-ACK, responding with ACK');

      const ackMessage: AckMessage = {
        penpal: MessageType.Ack,
        methodNames: Object.keys(methods)
      };

      parent.postMessage(ackMessage, parentOrigin);

      child.removeEventListener(NativeEventType.Message, handleMessageEvent);

      const info: WindowsInfo = {
        localName: 'Child',
        local: child,
        remote: parent,
        originForSending: event.origin === 'null' ? '*' : event.origin,
        originForReceiving: event.origin
      };

      const callSender: CallSender = {};

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
      resolve(callSender);
    };

    child.addEventListener(NativeEventType.Message, handleMessageEvent);

    onDestroy(() => {
      child.removeEventListener(NativeEventType.Message, handleMessageEvent);

      const error: PenpalError = new Error(
        'Connection destroyed'
      ) as PenpalError;
      error.code = ErrorCode.ConnectionDestroyed;
      reject(error);
    });

    log('Child: Handshake - Sending SYN');

    const synMessage: SynMessage = {
      penpal: MessageType.Syn
    };

    parent.postMessage(synMessage, parentOrigin);
  });

  return {
    promise,
    destroy
  };
};
