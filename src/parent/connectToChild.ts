import createDestructor, { Destructor } from '../createDestructor';
import getOriginFromSrc from './getOriginFromSrc';
import createLogger from '../createLogger';
import handleSynMessageFactory from './handleSynMessageFactory';
import handleAckMessageFactory from './handleAckMessageFactory';
import { Methods, PenpalError } from '../types';
import { ErrorCode, MessageType, NativeEventType } from '../enums';
import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';
import monitorIframeRemoval from './monitorIframeRemoval';
import startConnectionTimeout from '../startConnectionTimeout';

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
    childOrigin,
    originForSending
  );
  const handleAckMessage = handleAckMessageFactory(
    methods,
    childOrigin,
    originForSending,
    destructor,
    log
  );

  const promise = new Promise((resolve, reject) => {
    const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow || !event.data) {
        return;
      }

      if (event.data.penpal === MessageType.Syn) {
        handleSynMessage(event);
        return;
      }

      if (event.data.penpal === MessageType.Ack) {
        const callSender = handleAckMessage(event);

        if (callSender) {
          stopConnectionTimeout();
          resolve(callSender);
        }
        return;
      }
    };

    window.addEventListener(NativeEventType.Message, handleMessage);

    log('Parent: Awaiting handshake');
    monitorIframeRemoval(iframe, destructor);

    onDestroy((error?: PenpalError) => {
      window.removeEventListener(NativeEventType.Message, handleMessage);
      if (!error) {
        error = new Error('Connection destroyed') as PenpalError;
        error.code = ErrorCode.ConnectionDestroyed;
      }
      reject(error);
    });
  });

  return {
    promise,
    destroy() {
      // Don't allow consumer to pass an error into destroy.
      destroy();
    }
  };
};
