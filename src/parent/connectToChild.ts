import { RemoteMethodProxies, Connection, Methods } from '../types';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import createLogger from '../createLogger';
import PenpalError from '../PenpalError';
import ParentHandshaker from './ParentHandshaker';
import Messenger from '../Messenger';
import { ErrorCode } from '../enums';

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
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

/**
 * Attempts to establish communication with the child iframe or worker.
 */
export default <TMethods extends Methods = Methods>({
  messenger,
  methods = {},
  timeout,
  debug = false,
}: Options): Connection<TMethods> => {
  if (!messenger) {
    throw new PenpalError(
      ErrorCode.InvalidArgument,
      'messenger must be defined'
    );
  }

  const log = createLogger('Parent', debug);
  const flattenedMethods = flattenMethods(methods);
  const connectionClosedHandlers: (() => void)[] = [];

  const closeConnectionWithoutRejection = () => {
    for (const connectionClosedHandler of connectionClosedHandlers) {
      connectionClosedHandler();
    }

    log('Connection closed');
  };

  const promise = new Promise<RemoteMethodProxies<TMethods>>(
    (resolve, reject) => {
      const closeConnection = (error: PenpalError) => {
        closeConnectionWithoutRejection();
        reject(error);
      };

      connectionClosedHandlers.push(messenger.close);
      messenger.initialize({ log });

      const stopConnectionTimeout = startConnectionTimeout(
        timeout,
        closeConnection
      );

      const onRemoteMethodProxiesCreated = (
        remoteMethodProxies: RemoteMethodProxies<TMethods>
      ) => {
        stopConnectionTimeout();
        resolve(remoteMethodProxies);
      };

      const handshaker = new ParentHandshaker<TMethods>(
        messenger,
        flattenedMethods,
        closeConnection,
        onRemoteMethodProxiesCreated,
        log
      );
      connectionClosedHandlers.push(handshaker.close);

      log('Awaiting handshake');
    }
  );

  return {
    promise,
    close() {
      // Why we close the connection without rejecting the connection promise:
      // https://github.com/Aaronius/penpal/issues/51
      closeConnectionWithoutRejection();
    },
  };
};
