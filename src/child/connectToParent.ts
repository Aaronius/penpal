import {
  SynMessage,
  Methods,
  PenpalError,
  RemoteMethodProxies,
  PenpalMessage,
} from '../types';
import { ContextType, ErrorCode, MessageType } from '../enums';
import handleSynAckMessageFactory from './handleSynAckMessageFactory';
import { flattenMethods } from '../methodSerialization';
import startConnectionTimeout from '../startConnectionTimeout';
import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import ChildToParentMessenger from './ChildToParentMessenger';
import contextType from './contextType';

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
  destroy: () => void;
};

/**
 * Attempts to establish communication with the parent window.
 */
export default <TMethods extends Methods = Methods>(
  options: Options
): Connection<TMethods> => {
  const {
    parentOrigin,
    methods = {},
    timeout,
    channel,
    debug = false,
  } = options;

  const log = createLogger(debug);

  if (contextType === ContextType.Worker) {
    if (parentOrigin) {
      log(
        'Child: parentOrigin was specified, but is ignored when connecting from a worker'
      );
    }
  } else {
    if (!parentOrigin) {
      const error: PenpalError = new Error(
        `The parentOrigin option must be specified when connecting to a parent`
      ) as PenpalError;
      error.code = ErrorCode.OriginRequired;
      throw error;
    }
  }

  const destructor = createDestructor('Child', log);
  const messenger = new ChildToParentMessenger(
    parentOrigin,
    channel,
    log,
    destructor
  );

  const { destroy, onDestroy } = destructor;
  const flattenedMethods = flattenMethods(methods);

  const handleSynAckMessage = handleSynAckMessageFactory(
    messenger,
    flattenedMethods,
    destructor,
    log
  );

  const sendSynMessage = () => {
    log('Child: Handshake - Sending SYN');
    const synMessage: SynMessage = {
      type: MessageType.Syn,
    };
    messenger.sendMessage(synMessage);
  };

  const promise = new Promise<RemoteMethodProxies<TMethods>>(
    (resolve, reject) => {
      const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
      const handleMessage = (message: PenpalMessage) => {
        if (message.type === MessageType.SynAck) {
          messenger.removeMessageHandler(handleMessage);
          stopConnectionTimeout();
          const remoteMethodProxies = handleSynAckMessage<TMethods>(message);
          resolve(remoteMethodProxies);
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
