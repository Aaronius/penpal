import {
  SynMessage,
  Methods,
  PenpalError,
  CallSender,
  Remote,
  PenpalMessage,
  Destructor,
} from '../types';
import { MessageType } from '../enums';
import handleSynAckMessageFactory from './handleSynAckMessageFactory';
import { serializeMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import Messenger from '../Messenger';

type Options = {
  messenger: Messenger;
  /**
   * Methods that may be called by the parent window.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the parent to respond before rejecting the connection promise.
   */
  timeout?: number;
  log: (...args: unknown[]) => void;
  destructor: Destructor;
};

type Connection<TCallSender extends object = CallSender> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<Remote<TCallSender>>;
  /**
   * A method that, when called, will disconnect any messaging channels.
   * You may call this even before a connection has been established.
   */
  destroy: () => void;
};

/**
 * Attempts to establish communication with the parent window.
 */
export default <TCallSender extends object = CallSender>(
  options: Options
): Connection<TCallSender> => {
  const { messenger, methods = {}, timeout, log, destructor } = options;
  const { destroy, onDestroy } = destructor;
  const serializedMethods = serializeMethods(methods);

  const handleSynAckMessage = handleSynAckMessageFactory(
    messenger,
    serializedMethods,
    destructor,
    log
  );

  const sendSynMessage = () => {
    log('Child: Handshake - Sending SYN');
    const synMessage: SynMessage = { penpal: MessageType.Syn };
    messenger.sendMessage(synMessage);
  };

  const promise = new Promise<Remote<TCallSender>>((resolve, reject) => {
    const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
    const handleMessage = (message: PenpalMessage) => {
      if (message.penpal === MessageType.SynAck) {
        messenger.removeMessageHandler(handleMessage);
        stopConnectionTimeout();
        const callSender = handleSynAckMessage(message) as Remote<TCallSender>;
        resolve(callSender);
      }
    };

    messenger.addMessageHandler(handleMessage);

    sendSynMessage();

    onDestroy((error?: PenpalError) => {
      messenger.removeMessageHandler(handleMessage);

      if (error) {
        reject(error);
      }
    });
  });

  return {
    promise,
    destroy() {
      // Don't allow consumer to pass an error into destroy.
      destroy();
    },
  };
};
