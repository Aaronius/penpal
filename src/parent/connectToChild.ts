import {
  CallSender,
  PenpalError,
  AsyncMethodReturns,
  Connection,
  Methods,
  PenpalMessage,
} from '../types';
import { MessageType } from '../enums';
import { Destructor } from '../createDestructor';
import handleAckMessageFactory from './handleAckMessageFactory';
import handleSynMessageFactory from './handleSynMessageFactory';
import { serializeMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import CommsAdapter from '../CommsAdapter';

type Options = {
  commsAdapter: CommsAdapter;
  /**
   * Methods that may be called by the iframe.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the iframe to respond before rejecting the connection promise.
   */
  timeout?: number;
  log: (...args: any) => void;
  destructor: Destructor;
};

/**
 * Attempts to establish communication with an iframe.
 */
export default <TCallSender extends object = CallSender>(
  options: Options
): Connection<TCallSender> => {
  const { commsAdapter, methods = {}, timeout, log, destructor } = options;
  const { onDestroy, destroy } = destructor;

  const serializedMethods = serializeMethods(methods);
  const handleSynMessage = handleSynMessageFactory(
    commsAdapter,
    log,
    serializedMethods
  );
  const handleAckMessage = handleAckMessageFactory(
    commsAdapter,
    serializedMethods,
    destructor,
    log
  );

  const promise: Promise<AsyncMethodReturns<TCallSender>> = new Promise(
    (resolve, reject) => {
      const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
      const handleMessage = (message: PenpalMessage) => {
        if (message.penpal === MessageType.Syn) {
          handleSynMessage();
          return;
        }

        if (message.penpal === MessageType.Ack) {
          const callSender = handleAckMessage(message.methodNames);
          stopConnectionTimeout();
          resolve(callSender as AsyncMethodReturns<TCallSender>);
          return;
        }
      };

      commsAdapter.addMessageHandler(handleMessage);

      log('Parent: Awaiting handshake');

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
