import { Log, PenpalMessage, PenpalMessageEnvelope } from '../types';
import Messenger, { InitializeOptions, MessageHandler } from '../Messenger';
import namespace from '../namespace';
import {
  isAckMessage,
  isPenpalMessageEnvelope,
  isSynAckMessage,
} from '../guards';
import PenpalError from '../PenpalError';
import { ErrorCode } from '../enums';

type Options = {
  /**
   * The child web worker with which the parent will communicate.
   */
  childWorker: Worker;
  /**
   * A string identifier that locks down communication to a child worker
   * attempting to connect on the same channel.
   */
  channel?: string;
};

/**
 * Handles the details of communicating with a child web worker.
 */
class ParentToChildWorkerMessenger implements Messenger {
  private _childWorker: Worker;
  private _channel?: string;
  private _messageCallbacks = new Set<MessageHandler>();
  private _port?: MessagePort;
  private _log?: Log;

  constructor({ childWorker, channel }: Options) {
    if (!childWorker) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'childWorker must be defined'
      );
    }

    this._childWorker = childWorker;
    this._channel = channel;

    this._childWorker.addEventListener('message', this._handleMessageFromChild);
  }

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessageFromPort);
    this._port?.close();
    this._port = undefined;
  };

  private _handleMessageFromChild = (event: MessageEvent): void => {
    let messageEnvelope: PenpalMessageEnvelope;

    if (isPenpalMessageEnvelope(event.data)) {
      messageEnvelope = event.data;
    } else {
      // The received event doesn't pertain to Penpal.
      return;
    }

    if (messageEnvelope.channel !== this._channel) {
      return;
    }

    const { message } = messageEnvelope;

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

    const { channel, message } = event.data;

    if (channel !== this._channel) {
      return;
    }

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

    if (isSynAckMessage(message)) {
      this._childWorker.postMessage(envelope, {
        transfer: transferables,
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

  initialize = ({ log }: InitializeOptions) => {
    this._log = log;
  };

  close = () => {
    this._childWorker.removeEventListener(
      'message',
      this._handleMessageFromChild
    );
    this._destroyPort();
    this._messageCallbacks.clear();
  };
}

export default ParentToChildWorkerMessenger;
