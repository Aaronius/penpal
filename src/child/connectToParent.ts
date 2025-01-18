import { Methods, RemoteMethodProxies } from '../types';
import { ContextType } from '../enums';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import createLogger from '../createLogger';
import ChildToParentMessenger from './ChildToParentMessenger';
import contextType from './contextType';
import PenpalError from '../PenpalError';
import ChildHandleshaker from './ChildHandleshaker';

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
   * The channel to use to restrict communication. When specified, a connection
   * will only be made when the parent is connecting using the same channel.
   */
  channel?: string;
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

type Connection<TMethods extends Methods = Methods> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<RemoteMethodProxies<TMethods>>;
  /**
   * A method that, when called, will disconnect any communication.
   * You may call this even before a connection has been established.
   */
  close: () => void;
};

/**
 * Attempts to establish communication with the parent window.
 */
export default <TMethods extends Methods = Methods>(
  options: Options
): Connection<TMethods> => {
  const { methods = {}, timeout, channel, debug = false } = options;
  let { parentOrigin } = options;

  const log = createLogger('Child', debug);

  if (contextType === ContextType.Worker) {
    if (parentOrigin) {
      log(
        'parentOrigin was specified, but is ignored when connecting from a worker'
      );
    }
  } else {
    if (!parentOrigin) {
      parentOrigin = window.origin;
    }
  }

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

      const messenger = new ChildToParentMessenger(parentOrigin, channel, log);
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

      const handshaker = new ChildHandleshaker<TMethods>(
        messenger,
        flattenedMethods,
        closeConnection,
        onRemoteMethodProxiesCreated,
        log
      );

      connectionClosedHandlers.push(handshaker.close);
      handshaker.shake();
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
