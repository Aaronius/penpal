import { DestroyMessage, Connection, Log, Message, Methods } from './types.js';
import PenpalError from './PenpalError.js';
import Messenger from './messengers/Messenger.js';
import shakeHands from './shakeHands.js';
import { isDestroyMessage, isMessage } from './guards.js';
import once from './once.js';
import namespace from './namespace.js';

type Options = {
  /**
   * Messenger in charge of handling communication with the remote.
   */
  messenger: Messenger;
  /**
   * Methods that may be called by the remote.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for a connection to be established before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * A string identifier that disambiguates communication when establishing
   * multiple, parallel connections between two participants (e.g., two windows,
   * a window and a worker).
   */
  channel?: string;
  /**
   * A function for logging debug messages. Debug messages will only be
   * logged when this is defined.
   */
  log?: Log;
};

const usedMessengers = new WeakSet<Messenger>();

/**
 * Attempts to establish communication with the remote.
 */
const connect = <TMethods extends Methods>({
  messenger,
  methods = {},
  timeout,
  channel,
  log,
}: Options): Connection<TMethods> => {
  if (!messenger) {
    throw new PenpalError('INVALID_ARGUMENT', 'messenger must be defined');
  }

  if (usedMessengers.has(messenger)) {
    throw new PenpalError(
      'INVALID_ARGUMENT',
      'A messenger can only be used for a single connection'
    );
  }

  usedMessengers.add(messenger);

  const connectionDestroyedHandlers: (() => void)[] = [messenger.destroy];

  const destroyConnection = once((notifyOtherParticipant: boolean) => {
    if (notifyOtherParticipant) {
      const destroyMessage: DestroyMessage = {
        namespace,
        channel,
        type: 'DESTROY',
      };

      try {
        messenger.sendMessage(destroyMessage);
      } catch (_) {
        // We do our best to notify the other participant of the connection, but
        // if there's an error in doing so (e.g., maybe the handshake hasn't
        // completed and a messenger can't send the message), it's probably not
        // worth bothering the consumer with an error.
      }
    }

    for (const connectionDestroyedHandler of connectionDestroyedHandlers) {
      connectionDestroyedHandler();
    }

    log?.('Connection destroyed');
  });

  const validateReceivedMessage = (data: unknown): data is Message => {
    return isMessage(data) && data.channel === channel;
  };

  const promise = (async () => {
    try {
      messenger.initialize({ log, validateReceivedMessage });
      messenger.addMessageHandler((message) => {
        if (isDestroyMessage(message)) {
          destroyConnection(false);
        }
      });

      const { remoteProxy, destroy } = await shakeHands<TMethods>({
        messenger,
        methods,
        timeout,
        channel,
        log,
      });
      connectionDestroyedHandlers.push(destroy);
      return remoteProxy;
    } catch (error) {
      destroyConnection(true);
      throw error as PenpalError;
    }
  })();

  return {
    promise,
    // Why we don't reject the connection promise when consumer calls destroy():
    // https://github.com/Aaronius/penpal/issues/51
    destroy: () => {
      destroyConnection(true);
    },
  };
};

export default connect;
