import createDestructor from '../createDestructor';
import createLogger from '../createLogger';
import {
  SynMessage,
  Methods,
  PenpalError,
  CallSender,
  AsyncMethodReturns,
  PenpalMessage,
} from '../types';
import { MessageType, NativeEventType } from '../enums';
import handleSynAckMessageFactory from './handleSynAckMessageFactory';
import { serializeMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import IframeToParentAdapter from '../IframeToParentAdapter';

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

  let commsAdapter = new IframeToParentAdapter(parentOrigin, log, destructor);

  const handleSynAckMessage = handleSynAckMessageFactory(
    commsAdapter,
    parentOrigin,
    serializedMethods,
    destructor,
    log
  );

  const sendSynMessage = () => {
    log('Child: Handshake - Sending SYN');
    const synMessage: SynMessage = { penpal: MessageType.Syn };
    commsAdapter.sendMessageToRemote(synMessage);
  };

  const promise: Promise<AsyncMethodReturns<TCallSender>> = new Promise(
    (resolve, reject) => {
      const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
      const handleMessage = (message: PenpalMessage) => {
        if (message.penpal === MessageType.SynAck) {
          commsAdapter.stopListeningForMessagesFromRemote(handleMessage);
          stopConnectionTimeout();
          const callSender = handleSynAckMessage(message) as AsyncMethodReturns<
            TCallSender
          >;
          resolve(callSender);
        }
      };

      commsAdapter.listenForMessagesFromRemote(handleMessage);

      sendSynMessage();

      onDestroy((error?: PenpalError) => {
        commsAdapter.stopListeningForMessagesFromRemote(handleMessage);

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
