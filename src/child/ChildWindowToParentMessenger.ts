import { Log, PenpalMessage, PenpalMessageEnvelope } from '../types';
import Messenger, { InitializeOptions } from '../Messenger';
import namespace from '../namespace';
import {
  isAckMessage,
  isPenpalMessageEnvelope,
  isSynAckMessage,
  isSynMessage,
} from '../guards';

type Options = {
  parentOrigin?: string | RegExp;
  channel?: string;
};

class ChildWindowToParentMessenger implements Messenger {
  private _parentOrigin: string | RegExp;
  private _channel?: string;
  private _concreteParentOrigin?: string;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port1: MessagePort;
  private _port2: MessagePort;
  private _log?: Log;

  constructor({ parentOrigin = window.origin, channel }: Options = {}) {
    this._parentOrigin = parentOrigin;
    this._channel = channel;

    window.addEventListener('message', this._handleMessage);

    const { port1, port2 } = new MessageChannel();
    this._port1 = port1;
    this._port2 = port2;
    port1.addEventListener('message', this._handleMessage);
    port1.start();
  }

  private _isEventFromValidOrigin(event: MessageEvent): boolean {
    return this._parentOrigin instanceof RegExp
      ? this._parentOrigin.test(event.origin)
      : this._parentOrigin === '*' || this._parentOrigin === event.origin;
  }

  private _handleMessage = (event: MessageEvent): void => {
    if (!isPenpalMessageEnvelope(event.data)) {
      return;
    }

    const { channel, message } = event.data;

    if (channel !== this._channel) {
      return;
    }

    if (!this._isEventFromValidOrigin(event)) {
      this._log?.(
        `Received a message from origin "${event.origin} which did not match expected origin "${this._parentOrigin}"`
      );
      return;
    }

    if (isSynAckMessage(message)) {
      this._concreteParentOrigin = event.origin;
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  sendMessage = (message: PenpalMessage, transferables?: Transferable[]) => {
    const envelope: PenpalMessageEnvelope = {
      namespace,
      channel: this._channel,
      message,
    };

    if (isSynMessage(message)) {
      const originForSending =
        this._parentOrigin instanceof RegExp ? '*' : this._parentOrigin;
      window.parent.postMessage(envelope, {
        targetOrigin: originForSending,
        transfer: transferables,
      });
      return;
    }

    if (isAckMessage(message)) {
      const transferablesToSend = [this._port2, ...(transferables || [])];
      if (!this._concreteParentOrigin) {
        // If this ever happens, it's a bug in Penpal.
        throw new Error('Concrete child origin not set');
      }

      const originForSending =
        this._parentOrigin instanceof RegExp
          ? this._concreteParentOrigin
          : this._parentOrigin;
      window.parent.postMessage(envelope, {
        targetOrigin: originForSending,
        transfer: transferablesToSend,
      });
      return;
    }

    this._port1.postMessage(envelope, { transfer: transferables });
  };

  addMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.delete(callback);
  };

  initialize = ({ log }: InitializeOptions) => {
    this._log = log;
  };

  close = () => {
    window.removeEventListener('message', this._handleMessage);
    this._port1.removeEventListener('message', this._handleMessage);
    this._port1.close();
    this._messageCallbacks.clear();
  };
}

export default ChildWindowToParentMessenger;
