import {
  PenpalError,
  RemoteControl,
  Connection,
  Methods,
  PenpalMessage,
  Destructor,
} from '../types';
import { MessageType } from '../enums';
import handleAckMessageFactory from './handleAckMessageFactory';
import handleSynMessageFactory from './handleSynMessageFactory';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import Messenger from '../Messenger';

type Options = {
  messenger: Messenger;
  methods?: Methods;
  timeout?: number;
  channel?: string;
  log: (...args: unknown[]) => void;
  destructor: Destructor;
};

export default <TMethods extends Methods = Methods>(
  options: Options
): Connection<TMethods> => {
  const {
    messenger,
    methods = {},
    timeout,
    channel,
    log,
    destructor,
  } = options;
  const { onDestroy, destroy } = destructor;

  const flattenedMethods = flattenMethods(methods);
  const handleSynMessage = handleSynMessageFactory(
    messenger,
    channel,
    log,
    flattenedMethods
  );
  const handleAckMessage = handleAckMessageFactory<TMethods>(
    messenger,
    flattenedMethods,
    channel,
    destructor,
    log
  );

  const promise = new Promise<RemoteControl<TMethods>>((resolve, reject) => {
    const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
    const handleMessage = (message: PenpalMessage) => {
      if (message.type === MessageType.Syn) {
        handleSynMessage();
        return;
      }

      if (message.type === MessageType.Ack) {
        const callSender = handleAckMessage(message.methodPaths);
        stopConnectionTimeout();
        resolve(callSender);
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
  });

  return {
    promise,
    destroy() {
      // Don't allow consumer to pass an error into destroy.
      destroy();
    },
  };
};
