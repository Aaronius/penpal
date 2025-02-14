import { Message } from '../types';
import Messenger, { InitializeOptions, MessageHandler } from './Messenger';
import { isAck2Message, isAck1Message, isSynMessage } from '../guards';
import PenpalError from '../PenpalError';
import { ErrorCode } from '../enums';
import PenpalBugError from '../PenpalBugError';

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
  private _worker: MessageTarget;
  private _validateReceivedMessage?: (data: unknown) => data is Message;
  private _messageCallbacks = new Set<MessageHandler>();
  private _port?: MessagePort;

  constructor({ worker }: Options) {
    if (!worker) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'worker must be defined'
      );
    }

    this._worker = worker;
  }

  initialize = ({ validateReceivedMessage }: InitializeOptions) => {
    this._validateReceivedMessage = validateReceivedMessage;
    this._worker.addEventListener('message', this._handleMessage);
  };

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessage);
    this._port?.close();
    this._port = undefined;
  };

  private _handleMessage = ({ ports, data }: MessageEvent): void => {
    if (!this._validateReceivedMessage?.(data)) {
      return;
    }

    if (isSynMessage(data)) {
      // If we receive a SYN message and already have a port, it means
      // the child is re-connecting, in which case we'll receive a new port.
      // For this reason, we always make sure we destroy the existing port.
      this._destroyPort();
    }

    if (isAck2Message(data)) {
      this._port = ports[0];

      if (!this._port) {
        throw new PenpalBugError('No port received on ACK2');
      }

      this._port.addEventListener('message', this._handleMessage);
      this._port.start();
    }

    for (const callback of this._messageCallbacks) {
      callback(data);
    }
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    if (isSynMessage(message) || isAck1Message(message)) {
      this._worker.postMessage(message, { transfer: transferables });
      return;
    }

    if (isAck2Message(message)) {
      const { port1, port2 } = new MessageChannel();
      this._port = port1;
      port1.addEventListener('message', this._handleMessage);
      port1.start();

      this._worker.postMessage(message, {
        transfer: [port2, ...(transferables || [])],
      });
      return;
    }

    if (this._port) {
      this._port.postMessage(message, {
        transfer: transferables,
      });
      return;
    }

    throw new PenpalBugError('Port is undefined');
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.delete(callback);
  };

  destroy = () => {
    this._worker.removeEventListener('message', this._handleMessage);
    this._destroyPort();
    this._messageCallbacks.clear();
  };
}

export default WorkerMessenger;
