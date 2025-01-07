import {
  SynMessage,
  Methods,
  PenpalError,
  RemoteControl,
  PenpalMessage,
  Destructor,
} from '../types';
import { MessageType } from '../enums';
import handleSynAckMessageFactory from './handleSynAckMessageFactory';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import Messenger from '../Messenger';
import namespace from '../namespace';

type Options = {
  messenger: Messenger;
  methods?: Methods;
  timeout?: number;
  channel?: string;
  log: (...args: unknown[]) => void;
  destructor: Destructor;
};

type Connection<TMethods extends Methods = Methods> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<RemoteControl<TMethods>>;
  /**
   * A method that, when called, will disconnect any messaging channels.
   * You may call this even before a connection has been established.
   */
  destroy: () => void;
};

/**
 * Attempts to establish communication with the parent window.
 */
export default <TMethods extends Methods = Methods>(
  options: Options
): Connection<TMethods> => {
  const {
    messenger,
    channel,
    methods = {},
    timeout,
    log,
    destructor,
  } = options;
  const { destroy, onDestroy } = destructor;
  const flattenedMethods = flattenMethods(methods);

  const handleSynAckMessage = handleSynAckMessageFactory(
    messenger,
    channel,
    flattenedMethods,
    destructor,
    log
  );

  const sendSynMessage = () => {
    log('Child: Handshake - Sending SYN');
    const synMessage: SynMessage = {
      namespace,
      channel,
      type: MessageType.Syn,
    };
    messenger.sendMessage(synMessage);
  };

  const promise = new Promise<RemoteControl<TMethods>>((resolve, reject) => {
    const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
    const handleMessage = (message: PenpalMessage) => {
      if (message.type === MessageType.SynAck) {
        messenger.removeMessageHandler(handleMessage);
        stopConnectionTimeout();
        const callSender = handleSynAckMessage<TMethods>(message);
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
