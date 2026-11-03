import type { Message, PenpalTransferable } from '../types.js';
import type Messenger from './Messenger.js';
import type {
  InitializeMessengerOptions,
  MessageHandler,
} from './Messenger.js';
import PenpalError from '../PenpalError.js';

// Describe just the methods we use so browser consumers don't need Node types.
// Method signatures also accept Node's narrower set of transferable objects.
type NodeWorkerLike = {
  postMessage(
    value: unknown,
    transferList?: readonly PenpalTransferable[],
  ): void;
  addListener(event: 'message', listener: (value: unknown) => void): unknown;
  removeListener(event: 'message', listener: (value: unknown) => void): unknown;
};

type Options = {
  /**
   * The Node.js worker receiving/sending communication from/to this thread.
   * Within the worker, use PortMessenger with parentPort instead.
   */
  worker: NodeWorkerLike;
};

/**
 * Handles the details of communicating with a child Node.js worker thread.
 */
class NodeWorkerMessenger implements Messenger {
  #worker: NodeWorkerLike;
  #validateReceivedMessage: ((data: unknown) => data is Message) | undefined;
  #messageCallbacks = new Set<MessageHandler>();

  constructor({ worker }: Options) {
    if (!worker) {
      throw new PenpalError('INVALID_ARGUMENT', 'worker must be defined');
    }

    this.#worker = worker;
  }

  initialize = ({
    validateReceivedMessage,
  }: InitializeMessengerOptions): void => {
    this.#validateReceivedMessage = validateReceivedMessage;
    this.#worker.addListener('message', this.#handleMessage);
  };

  sendMessage = (
    message: Message,
    transferables?: PenpalTransferable[],
  ): void => {
    this.#worker.postMessage(message, transferables);
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.delete(callback);
  };

  destroy = (): void => {
    this.#worker.removeListener('message', this.#handleMessage);
    this.#messageCallbacks.clear();
  };

  #handleMessage = (data: unknown): void => {
    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    for (const callback of this.#messageCallbacks) {
      callback(data);
    }
  };
}

export default NodeWorkerMessenger;
