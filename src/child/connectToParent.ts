import createDestructor from '../createDestructor';
import createLogger from '../createLogger';
import {
  SynMessage,
  Methods,
  PenpalError,
  CallSender,
  AsyncMethodReturns,
} from '../types';
import { ErrorCode, MessageType, NativeEventType } from '../enums';
import handleSynAckMessageFactory from './handleSynAckMessageFactory';
import { serializeMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';

const areGlobalsAccessible = () => {
  try {
    clearTimeout();
  } catch (e) {
    return false;
  }
  return true;
};

type Options = {
  /**
   * Valid parent origin used to restrict communication.
   */
  parentOrigin?: string | RegExp;
  /**
   * Methods that may be called by the parent window.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the parent to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

type Connection<TCallSender extends object = CallSender> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<AsyncMethodReturns<TCallSender>>;
  /**
   * A method that, when called, will disconnect any messaging channels.
   * You may call this even before a connection has been established.
   */
  destroy: Function;
};

/**
 * Attempts to establish communication with the parent window.
 */
export default <TCallSender extends object = CallSender>(
  options: Options = {}
): Connection<TCallSender> => {
  const { parentOrigin = '*', methods = {}, timeout, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Child', log);
  const { destroy, onDestroy } = destructor;
  const serializedMethods = serializeMethods(methods);

  const handleSynAckMessage = handleSynAckMessageFactory(
    parentOrigin,
    serializedMethods,
    destructor,
    log
  );

  const sendSynMessage = () => {
    log('Child: Handshake - Sending SYN');
    const synMessage: SynMessage = { penpal: MessageType.Syn };
    const parentOriginForSyn =
      parentOrigin instanceof RegExp ? '*' : parentOrigin;
    window.parent.postMessage(synMessage, parentOriginForSyn);
  };

  const promise: Promise<AsyncMethodReturns<TCallSender>> = new Promise(
    (resolve, reject) => {
      const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
      const handleMessage = (event: MessageEvent) => {
        // Under niche scenarios, we get into this function after
        // the iframe has been removed from the DOM. In Edge, this
        // results in "Object expected" errors being thrown when we
        // try to access properties on window (global properties).
        // For this reason, we try to access a global up front (clearTimeout)
        // and if it fails we can assume the iframe has been removed
        // and we ignore the message event.
        if (!areGlobalsAccessible()) {
          return;
        }

        if (event.source !== parent || !event.data) {
          return;
        }

        if (event.data.penpal === MessageType.SynAck) {
          const callSender = handleSynAckMessage(event) as AsyncMethodReturns<
            TCallSender
          >;
          if (callSender) {
            window.removeEventListener(NativeEventType.Message, handleMessage);
            stopConnectionTimeout();
            resolve(callSender);
          }
        }
      };

      window.addEventListener(NativeEventType.Message, handleMessage);

      sendSynMessage();

      onDestroy((error?: PenpalError) => {
        window.removeEventListener(NativeEventType.Message, handleMessage);

        if (error) {
          reject(error);
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
