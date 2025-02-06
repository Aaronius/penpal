import { Message, Envelope } from '../types';
import Messenger, { MessageHandler } from './Messenger';
import {
  isAck2Message,
  isEnvelope,
  isAck1Message,
  isSynMessage,
} from '../guards';
import PenpalError from '../PenpalError';
import { ErrorCode } from '../enums';
import namespace from '../namespace';
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
  /**
   * A string identifier that disambiguates communication when establishing
   * multiple, parallel connections for a single worker. This is uncommon.
   * The same channel identifier must be specified on both `connectToChild` and
   * `connectToParent` in order for the connection between the two to be
   * established.
   */
  channel?: string;
};

/**
 * Handles the details of communicating with a child web worker.
 */
class WorkerMessenger implements Messenger {
  private _worker: MessageTarget;
  private _channel?: string;
  private _messageCallbacks = new Set<MessageHandler>();
  private _port?: MessagePort;

  constructor({ worker, channel }: Options) {
    if (!worker) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'worker must be defined'
      );
    }

    this._worker = worker;
    this._channel = channel;
  }

  initialize = () => {
    this._worker.addEventListener('message', this._handleMessage);
  };

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessage);
    this._port?.close();
    this._port = undefined;
  };

  private _handleMessage = (event: MessageEvent): void => {
    if (!isEnvelope(event.data)) {
      return;
    }

    const envelope: Envelope = event.data;
    const { channel, message } = envelope;

    if (channel !== this._channel) {
      return;
    }

    if (isSynMessage(message)) {
      // If we receive a SYN message and already have a port, it means
      // the child is re-connecting, in which case we'll receive a new port.
      // For this reason, we always make sure we destroy the existing port
      this._destroyPort();
    }

    if (isAck2Message(message)) {
      this._port = event.ports[0];

      if (!this._port) {
        throw new PenpalBugError('No port received on ACK2');
      }

      this._port.addEventListener('message', this._handleMessage);
      this._port.start();
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

    if (isSynMessage(message) || isAck1Message(message)) {
      this._worker.postMessage(envelope, { transfer: transferables });
      return;
    }

    if (isAck2Message(message)) {
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
      throw new PenpalBugError('Port is undefined');
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
  };
}

export default WorkerMessenger;
