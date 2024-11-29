import {
  CallSender,
  PenpalError,
  AsyncMethodReturns,
  Connection,
  Methods,
} from '../types';
import { ErrorCode, MessageType, NativeEventType } from '../enums';

import createDestructor from '../createDestructor';
import createLogger from '../createLogger';
import getOriginFromSrc from './getOriginFromSrc';
import handleAckMessageFactory from './handleAckMessageFactory';
import handleSynMessageFactory from './handleSynMessageFactory';
import { serializeMethods } from '../methodSerialization';
import monitorIframeRemoval from './monitorIframeRemoval';
import startConnectionTimeout from '../startConnectionTimeout';
import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';

type Options = {
  /**
   * The iframe to which a connection should be made.
   */
  iframe: HTMLIFrameElement;
  /**
   * Methods that may be called by the iframe.
   */
  methods?: Methods;
  /**
   * The child origin to use to secure communication. If
   * not provided, the child origin will be derived from the
   * iframe's src or srcdoc value.
   */
  childOrigin?: string;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the iframe to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
  /**
   * Callback function to be called when the connection with the child is lost.
   */
  onConnectionLost?: () => void;
  /**
   * Callback function to be called when the connection with the child is established or re-established.
   */
  onConnection?: () => void;
};

/**
 * Attempts to establish communication with an iframe.
 */
export default <TCallSender extends object = CallSender>(
  options: Options
): Connection<TCallSender> => {
  let { iframe, methods = {}, childOrigin, timeout, debug = false, onConnectionLost, onConnection } = options;

  const log = createLogger(debug);
  const destructor = createDestructor('Parent', log);
  const { onDestroy, destroy } = destructor;

  if (!childOrigin) {
    validateIframeHasSrcOrSrcDoc(iframe);
    childOrigin = getOriginFromSrc(iframe.src);
  }

  // If event.origin is "null", the remote protocol is file: or data: and we
  // must post messages with "*" as targetOrigin when sending messages.
  // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#Using_window.postMessage_in_extensions
  const originForSending = childOrigin === 'null' ? '*' : childOrigin;
  const serializedMethods = serializeMethods(methods);
  const handleSynMessage = handleSynMessageFactory(
    log,
    serializedMethods,
    childOrigin,
    originForSending
  );
  const handleAckMessage = handleAckMessageFactory(
    serializedMethods,
    childOrigin,
    originForSending,
    destructor,
    log
  );

  const promise: Promise<AsyncMethodReturns<TCallSender>> = new Promise(
    (resolve, reject) => {
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
          const callSender = handleAckMessage(event) as AsyncMethodReturns<
            TCallSender
          >;

          if (callSender) {
            stopConnectionTimeout();
            resolve(callSender);
            if (onConnection) {
              onConnection();
            }
          }
          return;
        }
      };

      window.addEventListener(NativeEventType.Message, handleMessage);

      log('Parent: Awaiting handshake');
      monitorIframeRemoval(iframe, destructor);

      onDestroy((error?: PenpalError) => {
        window.removeEventListener(NativeEventType.Message, handleMessage);

        if (error) {
          reject(error);
        }

        if (onConnectionLost) {
          onConnectionLost();
        }
      });
    }
  );

  return {
    promise,
    destroy() {
      // Don't allow consumer to pass an error into destroy.
      destroy();
    },
  };
};
