import type {
  Message,
  MessageEventLike,
  MessagePortLike,
  PenpalTransferable,
} from '../types.js';
import type Messenger from './Messenger.js';
import type {
  InitializeMessengerOptions,
  MessageHandler,
} from './Messenger.js';
import PenpalError from '../PenpalError.js';

type PortMessengerOptions = {
  /**
   * The port used to communicate to the other port of the port pair.
   */
  port: MessagePortLike;
};

/**
 * Handles the details of communicating on a MessagePort.
 */
class PortMessenger implements Messenger {
  #port: MessagePortLike | undefined;
  #validateReceivedMessage: ((data: unknown) => data is Message) | undefined;
  #messageCallbacks = new Set<MessageHandler>();

  constructor({ port }: PortMessengerOptions) {
    if (!port) {
      throw new PenpalError('INVALID_ARGUMENT', 'port must be defined');
    }

    this.#port = port;
  }

  initialize = ({
    validateReceivedMessage,
  }: InitializeMessengerOptions): void => {
    this.#validateReceivedMessage = validateReceivedMessage;
    this.#port?.addEventListener('message', this.#handleMessage);
    this.#port?.start();
  };

  sendMessage = (
    message: Message,
    transferables?: PenpalTransferable[],
  ): void => {
    if (!this.#port) {
      throw new PenpalError('CONNECTION_DESTROYED', 'Connection destroyed');
    }

    this.#port.postMessage(message, transferables);
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.delete(callback);
  };

  destroy = (): void => {
    const port = this.#port;
    // Release the caller's port and stop dispatch before removing the listener.
    this.#port = undefined;
    this.#validateReceivedMessage = undefined;
    this.#messageCallbacks.clear();
    port?.removeEventListener('message', this.#handleMessage);
  };

  #handleMessage = ({ data }: MessageEventLike): void => {
    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    for (const callback of this.#messageCallbacks) {
      callback(data);
    }
  };
}

export default PortMessenger;
