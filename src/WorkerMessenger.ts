import { Log, PenpalMessage, PenpalMessageEnvelope } from './types';
import Messenger, { MessageHandler } from './Messenger';
import namespace from './namespace';
import {
  isAckMessage,
  isPenpalMessageEnvelope,
  isSynAckMessage,
  isSynMessage,
} from './guards';
import PenpalError from './PenpalError';
import { ErrorCode } from './enums';
import {
  LOG_MESSAGE_CONNECTION_CLOSED,
  logReceivedMessage,
  logSendingMessage,
} from './commonLogging';

// If, inside a worker, the consumer passes `self` for the value of the
// `worker` option, it will be a type like DedicatedWorkerGlobalScope. Worker
// and DedicatedWorkerGlobalScope both have the below picked methods, but some
// of the other things on DedicatedWorkerGlobalScope cause conflicts if we were
// to use a union of Worker and DedicatedWorkerGlobalScope.
type MessageTarget = Pick<
  Worker,
  'postMessage' | 'addEventListener' | 'removeEventListener'
>;

type Options = {
  /**
   * The web worker receiving/sending communication from/to the parent window.
   * If WorkerMessenger is being used within the worker, `worker` should
   * typically be set to `self`.
   */
  worker: MessageTarget;
  /**
   * A string identifier that restricts communication to a specific channel.
   * This is only useful when setting up multiple, parallel connections
   * between a parent window and a single child web worker.
   */
  channel?: string;
  /**
   * A function for logging debug messages. When provided, messages will
   * be logged.
   */
  log?: Log;
};

/**
 * Handles the details of communicating with a child web worker.
 */
class WorkerMessenger implements Messenger {
  private _worker: MessageTarget;
  private _channel?: string;
  private _messageCallbacks = new Set<MessageHandler>();
  private _port?: MessagePort;
  private _log?: Log;

  constructor({ worker, channel, log }: Options) {
    if (!worker) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'worker must be defined'
      );
    }

    this._worker = worker;
    this._channel = channel;
    this._log = log;

    this._worker.addEventListener('message', this._handleMessage);
  }

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessageFromPort);
    this._port?.close();
    this._port = undefined;
  };

  private _handleMessage = (event: MessageEvent): void => {
    let envelope: PenpalMessageEnvelope;

    if (isPenpalMessageEnvelope(event.data)) {
      envelope = event.data;
    } else {
      // The received event doesn't pertain to Penpal.
      return;
    }

    const { channel, message } = envelope;

    if (channel !== this._channel) {
      return;
    }

    logReceivedMessage(envelope, this._log);

    if (isAckMessage(message)) {
      this._port = event.ports[0];

      if (!this._port) {
        // If this ever happens, it's a bug in Penpal.
        throw new Error('Handshake - No port received on ACK');
      }

      this._port.addEventListener('message', this._handleMessageFromPort);
      this._port.start();
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  private _handleMessageFromPort = (event: MessageEvent): void => {
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

    if (isSynMessage(message)) {
      this._worker.postMessage(envelope, { transfer: transferables });
      return;
    }

    if (isSynAckMessage(message)) {
      this._worker.postMessage(envelope, {
        transfer: transferables,
      });
      return;
    }

    if (isAckMessage(message)) {
      const { port1, port2 } = new MessageChannel();
      this._port = port1;
      port1.addEventListener('message', this._handleMessage);
      port1.start();

      this._worker.postMessage(envelope, {
        transfer: [port2, ...(transferables || [])],
      });
      return;
    }

    if (this._port) {
      this._port.postMessage(envelope, {
        transfer: transferables,
      });
    } else {
      // If this ever happens, it's a bug in Penpal.
      throw new Error('Port has not been received from child');
    }
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.delete(callback);
  };

  close = () => {
    this._worker.removeEventListener('message', this._handleMessage);
    this._destroyPort();
    this._messageCallbacks.clear();
    this._log?.(LOG_MESSAGE_CONNECTION_CLOSED);
  };
}

export default WorkerMessenger;
