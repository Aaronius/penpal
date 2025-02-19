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
  #port: MessagePort;
  #validateReceivedMessage?: (data: unknown) => data is Message;
  #messageCallbacks = new Set<MessageHandler>();

  constructor({ port }: Options) {
    if (!port) {
      throw new PenpalError(ErrorCode.InvalidArgument, 'port must be defined');
    }

    this.#port = port;
  }

  initialize = ({ validateReceivedMessage }: InitializeOptions) => {
    this.#validateReceivedMessage = validateReceivedMessage;
    this.#port.addEventListener('message', this.#handleMessage);
    this.#port.start();
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    this.#port?.postMessage(message, {
      transfer: transferables,
    });
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.delete(callback);
  };

  destroy = () => {
    this.#port.removeEventListener('message', this.#handleMessage);
    this.#port.close();
    this.#messageCallbacks.clear();
  };

  #handleMessage = ({ data }: MessageEvent): void => {
    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    for (const callback of this.#messageCallbacks) {
      callback(data);
    }
  };
}

export default PortMessenger;
