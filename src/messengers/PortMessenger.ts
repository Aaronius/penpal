import { Message } from '../types';
import Messenger, { InitializeOptions, MessageHandler } from './Messenger';
import PenpalError from '../PenpalError';
import { ErrorCode } from '../enums';

type Options = {
  /**
   * The port used to communicate to the other port of the port pair.
   */
  port: MessagePort;
};

/**
 * Handles the details of communicating on a MessagePort.
 */
class PortMessenger implements Messenger {
  private _port: MessagePort;
  private _validateReceivedMessage?: (data: unknown) => data is Message;
  private _messageCallbacks = new Set<MessageHandler>();

  constructor({ port }: Options) {
    if (!port) {
      throw new PenpalError(ErrorCode.InvalidArgument, 'port must be defined');
    }

    this._port = port;
  }

  initialize = ({ validateReceivedMessage }: InitializeOptions) => {
    this._validateReceivedMessage = validateReceivedMessage;
    this._port.addEventListener('message', this._handleMessage);
    this._port.start();
  };

  private _handleMessage = ({ data }: MessageEvent): void => {
    if (!this._validateReceivedMessage?.(data)) {
      return;
    }

    for (const callback of this._messageCallbacks) {
      callback(data);
    }
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    this._port?.postMessage(message, {
      transfer: transferables,
    });
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.delete(callback);
  };

  destroy = () => {
    this._port.removeEventListener('message', this._handleMessage);
    this._port.close();
    this._messageCallbacks.clear();
  };
}

export default PortMessenger;
