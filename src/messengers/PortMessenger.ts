import { Message, Envelope } from '../types';
import Messenger, { MessageHandler } from './Messenger';
import { isEnvelope } from '../guards';
import PenpalError from '../PenpalError';
import { ErrorCode } from '../enums';
import namespace from '../namespace';

type Options = {
  /**
   * The port used to communicate to the other port of the port pair.
   */
  port: MessagePort;
  /**
   * A string identifier that disambiguates communication when establishing
   * multiple, parallel connections over a single port pair. This is uncommon.
   * The same channel identifier must be specified on both `connectToChild` and
   * `connectToParent` in order for the connection between the two to be
   * established.
   */
  channel?: string;
};

/**
 * Handles the details of communicating on a MessagePort.
 */
class PortMessenger implements Messenger {
  private _port: MessagePort;
  private _channel?: string;
  private _messageCallbacks = new Set<MessageHandler>();

  constructor({ port, channel }: Options) {
    if (!port) {
      throw new PenpalError(ErrorCode.InvalidArgument, 'port must be defined');
    }

    this._port = port;
    this._channel = channel;
  }

  initialize = () => {
    this._port.addEventListener('message', this._handleMessage);
    this._port.start();
  };

  private _handleMessage = (event: MessageEvent): void => {
    if (!isEnvelope(event.data)) {
      return;
    }

    const envelope = event.data;
    const { channel, message } = envelope;

    if (channel !== this._channel) {
      return;
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    const envelope: Envelope = {
      namespace,
      channel: this._channel,
      message,
    };

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
  };
}

export default PortMessenger;
