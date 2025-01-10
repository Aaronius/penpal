import {
  PenpalError,
  RemoteMethodProxies,
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
  log: (...args: unknown[]) => void;
  destructor: Destructor;
};

export default <TMethods extends Methods = Methods>(
  options: Options
): Connection<TMethods> => {
  const { messenger, methods = {}, timeout, log, destructor } = options;
  const { onDestroy, destroy } = destructor;

  const flattenedMethods = flattenMethods(methods);
  const handleSynMessage = handleSynMessageFactory(
    messenger,
    log,
    flattenedMethods
  );
  const handleAckMessage = handleAckMessageFactory<TMethods>(
    messenger,
    flattenedMethods,
    destructor,
    log
  );

  const promise = new Promise<RemoteMethodProxies<TMethods>>(
    (resolve, reject) => {
      const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
      const handleMessage = (message: PenpalMessage) => {
        if (message.type === MessageType.Syn) {
          handleSynMessage();
          return;
        }

        if (message.type === MessageType.Ack) {
          const remoteMethodProxies = handleAckMessage(message.methodPaths);
          stopConnectionTimeout();
          resolve(remoteMethodProxies);
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
