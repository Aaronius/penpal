import { ContextType, MessageType } from '../enums';
import { Log, PenpalMessage, PenpalMessageEnvelope } from '../types';
import Messenger from '../Messenger';
import namespace from '../namespace';
import contextType from './contextType';
import Destructor from '../Destructor';

class ChildToParentMessenger implements Messenger {
  private _parentOrigin: string | RegExp | undefined;
  private _channel?: string;
  private _log: Log;
  private _concreteParentOrigin?: string;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port1: MessagePort;
  private _port2: MessagePort;

  constructor(
    parentOrigin: string | RegExp | undefined,
    channel: string | undefined,
    log: Log,
    destructor: Destructor
  ) {
    this._parentOrigin = parentOrigin;
    this._channel = channel;
    this._log = log;

    self.addEventListener('message', this._handleMessage);

    const { port1, port2 } = new MessageChannel();
    this._port1 = port1;
    this._port2 = port2;
    port1.addEventListener('message', this._handleMessage);
    port1.start();

    destructor.onDestroy(() => {
      self.removeEventListener('message', this._handleMessage);
      this._port1.removeEventListener('message', this._handleMessage);
      this._port1.close();
      this._messageCallbacks.clear();
    });
  }

  private _isEventFromValidOrigin(event: MessageEvent): boolean {
    if (
      // In both cases, origins are irrelevant.
      contextType === ContextType.Worker ||
      event.currentTarget instanceof MessagePort
    ) {
      return true;
    }
    return this._parentOrigin instanceof RegExp
      ? this._parentOrigin.test(event.origin)
      : this._parentOrigin === '*' || this._parentOrigin === event.origin;
  }

  private _handleMessage = (event: MessageEvent): void => {
    if (event.data?.namespace !== namespace) {
      return;
    }

    const { channel, message } = event.data as PenpalMessageEnvelope;

    if (channel !== this._channel) {
      return;
    }

    if (!this._isEventFromValidOrigin(event)) {
      this._log(
        `Received a message from origin "${event.origin} which did not match expected origin "${this._parentOrigin}"`
      );
      return;
    }

    if (message.type === MessageType.SynAck) {
      this._concreteParentOrigin = event.origin;
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  sendMessage = (message: PenpalMessage, transferables?: Transferable[]) => {
    const { type: messageType } = message;

    const envelope: PenpalMessageEnvelope = {
      namespace,
      channel: this._channel,
      message,
    };

    if (messageType === MessageType.Syn) {
      if (contextType === ContextType.Worker) {
        // Workers are always on the same origin as the parent window, so
        // we shouldn't specify a targetOrigin as it's irrelevant.
        self.postMessage(envelope, {
          transfer: transferables,
        });
      } else {
        const originForSending =
          this._parentOrigin instanceof RegExp ? '*' : this._parentOrigin;
        window.parent.postMessage(envelope, {
          targetOrigin: originForSending,
          transfer: transferables,
        });
      }
      return;
    }

    if (messageType === MessageType.Ack) {
      const transferablesToSend = [this._port2, ...(transferables || [])];
      if (contextType === ContextType.Worker) {
        // Workers are always on the same origin as the parent window, so
        // we shouldn't specify a targetOrigin as it's irrelevant.
        self.postMessage(envelope, {
          transfer: transferablesToSend,
        });
      } else {
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
      }
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
}

export default ChildToParentMessenger;
