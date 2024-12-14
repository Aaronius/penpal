import {
  CallSender,
  PenpalError,
  Remote,
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
import Messenger from '../Messenger';

type Options = {
  messenger: Messenger;
  /**
   * Methods that may be called by the iframe.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the iframe to respond before rejecting the connection promise.
   */
  timeout?: number;
  log: (...args: unknown[]) => void;
  destructor: Destructor;
};

/**
 * Attempts to establish communication with an iframe.
 */
export default <TCallSender extends object = CallSender>(
  options: Options
): Connection<TCallSender> => {
  const { messenger, methods = {}, timeout, log, destructor } = options;
  const { onDestroy, destroy } = destructor;

  const serializedMethods = serializeMethods(methods);
  const handleSynMessage = handleSynMessageFactory(
    messenger,
    log,
    serializedMethods
  );
  const handleAckMessage = handleAckMessageFactory(
    messenger,
    serializedMethods,
    destructor,
    log
  );

  const promise: Promise<Remote<TCallSender>> = new Promise(
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
          resolve(callSender as Remote<TCallSender>);
          return;
        }
      };

      messenger.addMessageHandler(handleMessage);

      log('Parent: Awaiting handshake');

      onDestroy((error?: PenpalError) => {
        messenger.removeMessageHandler(handleMessage);

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
