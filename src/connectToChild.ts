import createDestructor, { Destructor } from './createDestructor';
import getOriginFromSrc from './getOriginFromSrc';
import createLogger from './createLogger';
import connectCallReceiver from './connectCallReceiver';
import connectCallSender from './connectCallSender';
import {
  CallSender,
  Methods,
  PenpalError,
  SynAckMessage,
  WindowsInfo
} from './types';
import { ErrorCode, MessageType, NativeEventType } from './enums';

const CHECK_IFRAME_IN_DOC_INTERVAL = 60000;

type Options = {
  iframe: HTMLIFrameElement;
  methods?: Methods;
  childOrigin?: string;
  timeout?: number;
  debug?: boolean;
};

const handleSynMessage = (
  event: MessageEvent,
  log: Function,
  methods: Methods,
  originForSending: string
) => {
  log('Parent: Handshake - Received SYN, responding with SYN-ACK');

  const synAckMessage: SynAckMessage = {
    penpal: MessageType.SynAck,
    methodNames: Object.keys(methods)
  };

  (event.source as Window).postMessage(synAckMessage, originForSending);
};

const handleAckMessage = (
  event: MessageEvent,
  log: Function,
  methods: Methods,
  parent: Window,
  child: Window,
  originForSending: string,
  childOrigin: string,
  destroyCallReceiver: Function,
  callSender: CallSender,
  destructor: Destructor,
  connectionTimeoutId: number
) => {
  const { destroy, onDestroy } = destructor;

  log('Parent: Handshake - Received ACK');

  const info: WindowsInfo = {
    localName: 'Parent',
    local: parent,
    remote: child!,
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
  Object.keys(callSender).forEach(key => {
    delete callSender[key];
  });

  const receiverMethodNames = event.data.methodNames;
  const destroyCallSender = connectCallSender(
    callSender,
    info,
    receiverMethodNames,
    destroy,
    log
  );

  onDestroy(destroyCallSender);

  clearTimeout(connectionTimeoutId);

  return destroyCallReceiver;
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
    if (!iframe.src && !iframe.srcdoc) {
      const error: PenpalError = new Error(
        'Iframe must have src or srcdoc property defined.'
      ) as PenpalError;
      error.code = ErrorCode.NoIframeSrc;
      throw error;
    }

    childOrigin = getOriginFromSrc(iframe.src);
  }

  // If event.origin is "null", the remote protocol is
  // file:, data:, and we must post messages with "*" as targetOrigin
  // when sending and allow
  // [1] https://developer.mozilla.org/fr/docs/Web/API/Window/postMessage#Utiliser_window.postMessage_dans_les_extensions
  const originForSending = childOrigin === 'null' ? '*' : childOrigin;

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

    // We resolve the promise with the call sender. If the child reconnects (for example, after
    // refreshing or navigating to another page that uses Penpal, we'll update the call sender
    // with methods that match the latest provided by the child.
    const callSender: CallSender = {};
    let destroyCallReceiver: Function;

    const handleMessage = (event: MessageEvent) => {
      const child = iframe.contentWindow;

      if (event.source !== child) {
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
        handleSynMessage(event, log, methods, originForSending);
        return;
      }

      if (event.data.penpal === MessageType.Ack) {
        destroyCallReceiver = handleAckMessage(
          event,
          log,
          methods,
          parent,
          child!,
          originForSending,
          childOrigin!,
          destroyCallReceiver,
          callSender,
          destructor,
          connectionTimeoutId
        );

        resolve(callSender);
        return;
      }
    };

    parent.addEventListener(NativeEventType.Message, handleMessage);

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
      parent.removeEventListener(NativeEventType.Message, handleMessage);
      clearInterval(checkIframeInDocIntervalId);

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
