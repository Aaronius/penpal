import { RemoteMethodProxies, Connection, Methods } from '../types';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import PenpalError from '../PenpalError';
import ParentHandshaker from './ParentHandshaker';
import Messenger from '../Messenger';
import { ErrorCode } from '../enums';

type Options = {
  /**
   * Messenger in charge of handling communication with the child.
   */
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
};

/**
 * Attempts to establish communication with the child iframe or web worker.
 */
export default <TMethods extends Methods = Methods>({
  messenger,
  methods = {},
  timeout,
}: Options): Connection<TMethods> => {
  if (!messenger) {
    throw new PenpalError(
      ErrorCode.InvalidArgument,
      'messenger must be defined'
    );
  }

  const flattenedMethods = flattenMethods(methods);
  const connectionClosedHandlers: (() => void)[] = [];

  const closeConnectionWithoutRejection = () => {
    for (const connectionClosedHandler of connectionClosedHandlers) {
      connectionClosedHandler();
    }
  };

  const promise = new Promise<RemoteMethodProxies<TMethods>>(
    (resolve, reject) => {
      const closeConnection = (error: PenpalError) => {
        closeConnectionWithoutRejection();
        reject(error);
      };

      connectionClosedHandlers.push(messenger.close);

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
        onRemoteMethodProxiesCreated
      );
      connectionClosedHandlers.push(handshaker.close);
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
