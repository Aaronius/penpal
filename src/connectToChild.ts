import createDestructor, { Destructor } from './createDestructor';
import getOriginFromSrc from './getOriginFromSrc';
import createLogger from './createLogger';
import handleSynMessageFactory from './handleSynMessageFactory';
import handleAckMessageFactory from './handleAckMessageFactory';
import {
  Methods,
  PenpalError,
} from './types';
import { ErrorCode, MessageType, NativeEventType } from './enums';
import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';
import monitorIframeRemoval from './monitorIframeRemoval';

type Options = {
  iframe: HTMLIFrameElement;
  methods?: Methods;
  childOrigin?: string;
  timeout?: number;
  debug?: boolean;
};

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
export default (options: Options) => {
  let { iframe, methods = {}, childOrigin, timeout, debug = false } = options;

  const log = createLogger(debug);
  const parent = window;
  const destructor = createDestructor();
  const { onDestroy, destroy } = destructor;

  if (!childOrigin) {
    validateIframeHasSrcOrSrcDoc(iframe);
    childOrigin = getOriginFromSrc(iframe.src);
  }

  // If event.origin is "null", the remote protocol is
  // file:, data:, and we must post messages with "*" as targetOrigin
  // when sending and allow
  // [1] https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage#Utiliser_window.postMessage_dans_les_extensions
  const originForSending = childOrigin === 'null' ? '*' : childOrigin;
  const handleSynMessage = handleSynMessageFactory(
    log,
    methods,
    originForSending
  );
  const handleAckMessage = handleAckMessageFactory(
    parent,
    methods,
    childOrigin,
    originForSending,
    destructor,
    log
  );

  const promise = new Promise((resolve, reject) => {
    let connectionTimeoutId: number;

    if (timeout !== undefined) {
      connectionTimeoutId = window.setTimeout(() => {
        const error: PenpalError = new Error(
          `Connection to child timed out after ${timeout}ms`
        ) as PenpalError;
        error.code = ErrorCode.ConnectionTimeout;
        reject(error);
        destroy();
      }, timeout);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) {
        return;
      }

      if (
        event.origin !== childOrigin &&
        (
          event.data.penpal === MessageType.Syn ||
          event.data.penpal === MessageType.Ack
        )
      ) {
        log(
          `Parent: Handshake - Received message from origin ${
            event.origin
          } which did not match expected origin ${childOrigin}`
        );
        return;
      }

      if (event.data.penpal === MessageType.Syn) {
        handleSynMessage(event);
        return;
      }

      if (event.data.penpal === MessageType.Ack) {
        const callSender = handleAckMessage(event);
        clearTimeout(connectionTimeoutId);
        resolve(callSender);
        return;
      }
    };

    parent.addEventListener(NativeEventType.Message, handleMessage);

    log('Parent: Awaiting handshake');
    monitorIframeRemoval(iframe, destructor);

    onDestroy(() => {
      parent.removeEventListener(NativeEventType.Message, handleMessage);
      const error: PenpalError = new Error(
        'Connection destroyed'
      ) as PenpalError;
      error.code = ErrorCode.ConnectionDestroyed;
      reject(error);
    });
  });

  return {
    promise,
    destroy
  };
};
