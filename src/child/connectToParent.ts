import { Destructor } from '../createDestructor';
import {
  SynMessage,
  Methods,
  PenpalError,
  CallSender,
  AsyncMethodReturns,
  PenpalMessage,
} from '../types';
import { MessageType } from '../enums';
import handleSynAckMessageFactory from './handleSynAckMessageFactory';
import { serializeMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import CommsAdapter from '../CommsAdapter';

type Options = {
  commsAdapter: CommsAdapter;
  /**
   * Methods that may be called by the parent window.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the parent to respond before rejecting the connection promise.
   */
  timeout?: number;
  log: (...args: any) => void;
  destructor: Destructor;
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
  options: Options
): Connection<TCallSender> => {
  const { commsAdapter, methods = {}, timeout, log, destructor } = options;
  const { destroy, onDestroy } = destructor;
  const serializedMethods = serializeMethods(methods);

  const handleSynAckMessage = handleSynAckMessageFactory(
    commsAdapter,
    serializedMethods,
    destructor,
    log
  );

  const sendSynMessage = () => {
    log('Child: Handshake - Sending SYN');
    const synMessage: SynMessage = { penpal: MessageType.Syn };
    commsAdapter.sendMessage(synMessage);
  };

  const promise: Promise<AsyncMethodReturns<TCallSender>> = new Promise(
    (resolve, reject) => {
      const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
      const handleMessage = (message: PenpalMessage) => {
        if (message.penpal === MessageType.SynAck) {
          commsAdapter.removeMessageHandler(handleMessage);
          stopConnectionTimeout();
          const callSender = handleSynAckMessage(message) as AsyncMethodReturns<
            TCallSender
          >;
          resolve(callSender);
        }
      };

      commsAdapter.addMessageHandler(handleMessage);

      sendSynMessage();

      onDestroy((error?: PenpalError) => {
        commsAdapter.removeMessageHandler(handleMessage);

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
