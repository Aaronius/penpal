import { CloseMessage, Connection, Log, Message, Methods } from './types';
import PenpalError from './PenpalError';
import Messenger from './messengers/Messenger';
import { ErrorCode, MessageType } from './enums';
import shakeHands from './shakeHands';
import { isCloseMessage, isMessage } from './guards';
import once from './once';
import namespace from './namespace';

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
   * for the remote to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * A string identifier that disambiguates communication when establishing
   * multiple, parallel connections between two participants, for example,
   * two windows, a window and a worker, etc. The same channel identifier
   * (which is a string of your choosing) must be provided by both participants
   * in order for the connection between the two to be established.
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
    throw new PenpalError(
      ErrorCode.InvalidArgument,
      'messenger must be defined'
    );
  }

  if (usedMessengers.has(messenger)) {
    throw new PenpalError(
      ErrorCode.InvalidArgument,
      'A messenger can only be used for a single connection'
    );
  }

  usedMessengers.add(messenger);

  const connectionClosedHandlers: (() => void)[] = [messenger.close];

  const closeConnection = once((notifyOtherParticipant: boolean) => {
    if (notifyOtherParticipant) {
      const closeMessage: CloseMessage = {
        namespace,
        channel,
        type: MessageType.Close,
      };

      try {
        messenger.sendMessage(closeMessage);
      } catch (_) {
        // We do our best to notify the other participant of the connection, but
        // if there's an error in doing so (e.g., maybe the handshake hasn't
        // completed and a messenger can't send the message), it's probably not
        // worth bothering the consumer with an error.
      }
    }

    for (const connectionClosedHandler of connectionClosedHandlers) {
      connectionClosedHandler();
    }

    log?.('Connection closed');
  });

  const validateReceivedMessage = (data: unknown): data is Message => {
    return isMessage(data) && data.channel === channel;
  };

  const promise = (async () => {
    try {
      messenger.initialize({ log, validateReceivedMessage });
      messenger.addMessageHandler((message) => {
        if (isCloseMessage(message)) {
          closeConnection(false);
        }
      });

      const { remoteProxy, close } = await shakeHands<TMethods>({
        messenger,
        methods,
        timeout,
        channel,
        log,
      });
      connectionClosedHandlers.push(close);
      return remoteProxy;
    } catch (error) {
      closeConnection(true);
      throw error as PenpalError;
    }
  })();

  return {
    promise,
    // Why we don't reject the connection promise when consumer calls close():
    // https://github.com/Aaronius/penpal/issues/51
    close: () => {
      closeConnection(true);
    },
  };
};

export default connect;
