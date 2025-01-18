import { RemoteMethodProxies, Connection, Methods } from '../types';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import createLogger from '../createLogger';
import ParentToChildMessenger from './ParentToChildMessenger';
import deriveOriginFromIframe from './deriveOriginFromIframe';
import PenpalError from '../PenpalError';
import ParentHandshaker from './ParentHandshaker';

type Options = {
  /**
   * The iframe or worker to which a connection should be made.
   */
  child: HTMLIFrameElement | Worker;
  /**
   * Methods that may be called by the iframe.
   */
  methods?: Methods;
  /**
   * The child origin to use to secure communication. If
   * not provided, the child origin will be derived from the
   * iframe's src or srcdoc value.
   */
  childOrigin?: string | RegExp;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the iframe to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * The channel to use to restrict communication. When specified, a connection
   * will only be made when the child is connecting using the same channel.
   */
  channel?: string;
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

/**
 * Attempts to establish communication with the child iframe or worker.
 */
export default <TMethods extends Methods = Methods>(
  options: Options
): Connection<TMethods> => {
  const { child, methods = {}, timeout, channel, debug = false } = options;
  let { childOrigin } = options;
  const log = createLogger('Parent', debug);

  if (child instanceof Worker) {
    if (childOrigin) {
      log(
        'childOrigin was specified, but is ignored when connecting to a worker'
      );
    }
  } else {
    if (!childOrigin) {
      childOrigin = deriveOriginFromIframe(child, log);
    }
  }

  // Move into handshaker? Same with ChildHandshaker?
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

      const messenger = new ParentToChildMessenger(
        child,
        childOrigin,
        channel,
        log
      );
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
