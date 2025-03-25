import { Message } from '../types.js';
import Messenger, {
  InitializeMessengerOptions,
  MessageHandler,
} from './Messenger.js';
import { isAck2Message, isAck1Message, isSynMessage } from '../guards.js';
import PenpalError from '../PenpalError.js';
import PenpalBugError from '../PenpalBugError.js';

// This is needed to resolve some conflict errors. There may be a better way.
type MessageTarget = Pick<
  Worker,
  'postMessage' | 'addEventListener' | 'removeEventListener'
>;

type Options = {
  /**
   * The web worker receiving/sending communication from/to the parent window.
   * If this messenger is being used within the worker, `worker` should
   * typically be set to `self`.
   */
  worker: Worker | DedicatedWorkerGlobalScope;
};

/**
 * Handles the details of communicating with a child web worker.
 */
class WorkerMessenger implements Messenger {
  #worker: MessageTarget;
  #validateReceivedMessage?: (data: unknown) => data is Message;
  #messageCallbacks = new Set<MessageHandler>();
  #port?: MessagePort;

  constructor({ worker }: Options) {
    if (!worker) {
      throw new PenpalError('INVALID_ARGUMENT', 'worker must be defined');
    }

    this.#worker = worker;
  }

  initialize = ({ validateReceivedMessage }: InitializeMessengerOptions) => {
    this.#validateReceivedMessage = validateReceivedMessage;
    this.#worker.addEventListener('message', this.#handleMessage);
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    if (isSynMessage(message) || isAck1Message(message)) {
      this.#worker.postMessage(message, { transfer: transferables });
      return;
    }

    if (isAck2Message(message)) {
      const { port1, port2 } = new MessageChannel();
      this.#port = port1;
      port1.addEventListener('message', this.#handleMessage);
      port1.start();

      this.#worker.postMessage(message, {
        transfer: [port2, ...(transferables || [])],
      });
      return;
    }

    if (this.#port) {
      this.#port.postMessage(message, {
        transfer: transferables,
      });
      return;
    }

    throw new PenpalBugError('Port is undefined');
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.delete(callback);
  };

  destroy = () => {
    this.#worker.removeEventListener('message', this.#handleMessage);
    this.#destroyPort();
    this.#messageCallbacks.clear();
  };

  #destroyPort = () => {
    this.#port?.removeEventListener('message', this.#handleMessage);
    this.#port?.close();
    this.#port = undefined;
  };

  #handleMessage = ({ ports, data }: MessageEvent): void => {
    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    if (isSynMessage(data)) {
      // If we receive a SYN message and already have a port, it means
      // the child is re-connecting, in which case we'll receive a new port.
      // For this reason, we always make sure we destroy the existing port.
      this.#destroyPort();
    }

    if (isAck2Message(data)) {
      this.#port = ports[0];

      if (!this.#port) {
        throw new PenpalBugError('No port received on ACK2');
      }

      this.#port.addEventListener('message', this.#handleMessage);
      this.#port.start();
    }

    for (const callback of this.#messageCallbacks) {
      callback(data);
    }
  };
}

export default WorkerMessenger;
