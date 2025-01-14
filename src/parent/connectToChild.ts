import {
  PenpalError,
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

export default <TMethods extends Methods = Methods>(
  options: Options
): Connection<TMethods> => {
  const {
    child,
    methods = {},
    childOrigin,
    timeout,
    channel,
    debug = false,
  } = options;

  const log = createLogger(debug);

  if (childOrigin && child instanceof Worker) {
    log(
      'Parent: childOrigin was specified, but is ignored when connecting to a worker'
    );
  }

  const destructor = createDestructor('Parent', log);
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
