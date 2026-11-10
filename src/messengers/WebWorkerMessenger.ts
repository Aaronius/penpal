import type {
  Log,
  Message,
  MessageEventLike,
  MessageEventTarget,
  MessagePortLike,
  PenpalTransferable,
} from '../types.js';
import type Messenger from './Messenger.js';
import type {
  InitializeMessengerOptions,
  MessageHandler,
} from './Messenger.js';
import { isAck2Message, isAck1Message, isSynMessage } from '../guards.js';
import PenpalError from '../PenpalError.js';

// The minimal worker API this messenger uses internally in every environment.
// Also used for the public `worker` option when no global Worker type is
// available, such as in Node-only projects. Avoid referencing browser-only
// Worker and DedicatedWorkerGlobalScope types so those projects can import
// Penpal without browser declarations.
type WorkerEndpoint = MessageEventTarget & {
  postMessage(
    message: unknown,
    options?: { transfer?: PenpalTransferable[] },
  ): void;
};

// When browser types are available, derive the instance type from the global
// Worker constructor. This lets the `worker` option retain the browser's full
// addEventListener/removeEventListener signatures (e.g. 'error' events and
// options such as { once: true }), rather than only our 'message' signature.
// In Node-only projects without a global Worker, use WorkerEndpoint instead
// so importing Penpal does not require browser types.
type NativeWorker = typeof globalThis extends {
  Worker: { prototype: infer Instance };
}
  ? Instance
  : WorkerEndpoint;

type WorkerLike = Pick<
  NativeWorker,
  'postMessage' | 'addEventListener' | 'removeEventListener'
>;

type WebWorkerMessengerOptions = {
  /**
   * The web worker receiving/sending communication from/to the parent window.
   * If this messenger is being used within the worker, `worker` should
   * typically be set to `self`.
   */
  worker: WorkerLike;
};

/**
 * Handles the details of communicating with a child web worker.
 */
class WebWorkerMessenger implements Messenger {
  #worker: WorkerEndpoint;
  #log: Log | undefined;
  #validateReceivedMessage: ((data: unknown) => data is Message) | undefined;
  #messageCallbacks = new Set<MessageHandler>();
  #port: MessagePortLike | undefined;

  constructor({ worker }: WebWorkerMessengerOptions) {
    if (!worker) {
      throw new PenpalError('INVALID_ARGUMENT', 'worker must be defined');
    }

    this.#worker = worker;
  }

  initialize = ({
    log,
    validateReceivedMessage,
  }: InitializeMessengerOptions): void => {
    this.#log = log;
    this.#validateReceivedMessage = validateReceivedMessage;
    this.#worker.addEventListener('message', this.#handleMessage);
  };

  sendMessage = (
    message: Message,
    transferables?: PenpalTransferable[],
  ): void => {
    if (isSynMessage(message) || isAck1Message(message)) {
      this.#worker.postMessage(message, {
        ...(transferables === undefined ? {} : { transfer: transferables }),
      });
      return;
    }

    if (isAck2Message(message)) {
      const { port1, port2 } = new MessageChannel();
      this.#setPort(port1);

      try {
        this.#worker.postMessage(message, {
          transfer: [port2, ...(transferables || [])],
        });
      } catch (error) {
        this.#destroyPort();
        port2.close();
        throw error;
      }

      return;
    }

    if (this.#port) {
      this.#port.postMessage(message, transferables);
      return;
    }

    throw new PenpalError(
      'TRANSMISSION_FAILED',
      'Cannot send message because the MessagePort is not connected',
    );
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.delete(callback);
  };

  destroy = (): void => {
    this.#validateReceivedMessage = undefined;
    this.#worker.removeEventListener('message', this.#handleMessage);
    this.#destroyPort();
    this.#messageCallbacks.clear();
  };

  #destroyPort = () => {
    this.#port?.removeEventListener('message', this.#handleMessage);
    this.#port?.close();
    this.#port = undefined;
  };

  #setPort = (port: MessagePortLike) => {
    this.#destroyPort();
    this.#port = port;
    this.#port.addEventListener('message', this.#handleMessage);
    this.#port.start();
  };

  #handleMessage = ({ ports, data }: MessageEventLike): void => {
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
      const port = ports[0];

      if (!port) {
        this.#log?.('Ignoring ACK2 because it did not include a MessagePort');
        return;
      }

      this.#setPort(port);
    }

    for (const callback of this.#messageCallbacks) {
      callback(data);
    }
  };
}

export default WebWorkerMessenger;
