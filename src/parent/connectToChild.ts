import {
  RemoteMethodProxies,
  Connection,
  Methods,
  PenpalMessage,
} from '../types';
import { MessageType } from '../enums';
import handleAckMessageFactory from './handleAckMessageFactory';
import handleSynMessageFactory from './handleSynMessageFactory';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import ParentToChildMessenger from './ParentToChildMessenger';
import deriveOriginFromIframe from './deriveOriginFromIframe';
import monitorIframeRemoval from './monitorIframeRemoval';
import PenpalError from '../PenpalError';

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
  const destructor = createDestructor(log);

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
    monitorIframeRemoval(child, destructor);
  }

  const messenger = new ParentToChildMessenger(
    child,
    childOrigin,
    channel,
    log,
    destructor
  );

  const { onDestroy, destroy } = destructor;

  const flattenedMethods = flattenMethods(methods);
  const handleSynMessage = handleSynMessageFactory(
    messenger,
    flattenedMethods,
    destructor,
    log
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

      log('Awaiting handshake');

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
