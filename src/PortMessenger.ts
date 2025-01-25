import { Log, PenpalMessage, PenpalMessageEnvelope } from './types';
import Messenger, { MessageHandler } from './Messenger';
import namespace from './namespace';
import { isPenpalMessageEnvelope } from './guards';
import PenpalError from './PenpalError';
import { ErrorCode } from './enums';
import {
  LOG_MESSAGE_CONNECTION_CLOSED,
  logReceivedMessage,
  logSendingMessage,
} from './commonLogging';

type Options = {
  /**
   * The port used to communicate to the other port of the port pair.
   */
  port: MessagePort;
  /**
   * A string identifier that restricts communication to a specific channel.
   * This is only useful when setting up multiple, parallel connections
   * through a single port pair.
   */
  channel?: string;
  /**
   * A function for logging debug messages. When provided, messages will
   * be logged.
   */
  log?: Log;
};

/**
 * Handles the details of communicating on a MessagePort.
 */
class PortMessenger implements Messenger {
  private _port: MessagePort;
  private _channel?: string;
  private _messageCallbacks = new Set<MessageHandler>();
  private _log?: Log;

  constructor({ port, channel, log }: Options) {
    if (!port) {
      throw new PenpalError(ErrorCode.InvalidArgument, 'port must be defined');
    }

    this._port = port;
    this._channel = channel;
    this._log = log;

    this._port.addEventListener('message', this._handleMessage);
    this._port.start();
  }

  private _handleMessage = (event: MessageEvent): void => {
    if (!isPenpalMessageEnvelope(event.data)) {
      return;
    }

    const envelope = event.data;
    const { channel, message } = envelope;

    if (channel !== this._channel) {
      return;
    }

    logReceivedMessage(envelope, this._log);

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  sendMessage = (
    message: PenpalMessage,
    transferables?: Transferable[]
  ): void => {
    const envelope: PenpalMessageEnvelope = {
      namespace,
      channel: this._channel,
      message,
    };

    logSendingMessage(envelope, this._log);

    this._port?.postMessage(envelope, {
      transfer: transferables,
    });
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.delete(callback);
  };

  close = () => {
    this._port.removeEventListener('message', this._handleMessage);
    this._port.close();
    this._messageCallbacks.clear();
    this._log?.(LOG_MESSAGE_CONNECTION_CLOSED);
  };
}

export default PortMessenger;
