import { Destructor } from '../createDestructor';
import { ErrorCode, MessageType } from '../enums';
import { PenpalError, PenpalMessage } from '../types';
import CommsAdapter from '../CommsAdapter';

class IframeToParentAdapter implements CommsAdapter {
  private _parentOrigin: string | RegExp;
  private _log: Function;
  private _messageCallbacks: Set<(message: PenpalMessage) => void> = new Set();
  private _port1: MessagePort;
  private _port2: MessagePort;

  constructor(
    parentOrigin: string | RegExp,
    log: Function,
    destructor: Destructor
  ) {
    this._log = log;
    this._parentOrigin = parentOrigin;

    if (!parentOrigin) {
      const error: PenpalError = new Error(
        `The parentOrigin option must be specified when connecting to a parent from an iframe`
      ) as PenpalError;

      error.code = ErrorCode.OriginRequired;
      throw error;
    }

    window.addEventListener('message', this._handleMessageFromWindow);

    const { port1, port2 } = new MessageChannel();
    this._port1 = port1;
    this._port2 = port2;
    port1.addEventListener('message', this._handleMessageFromPort);
    port1.start();

    destructor.onDestroy(() => {
      window.removeEventListener('message', this._handleMessageFromWindow);
      port1.removeEventListener('message', this._handleMessageFromPort);
      port1.close();
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromWindow = (event: MessageEvent): void => {
    if (!event.data?.penpal) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;
    const { penpal: messageType } = penpalMessage;

    if (messageType === MessageType.SynAck) {
      const originQualifies =
        this._parentOrigin instanceof RegExp
          ? this._parentOrigin.test(event.origin)
          : this._parentOrigin === '*' || this._parentOrigin === event.origin;
      if (!originQualifies) {
        this._log(
          `Child: Handshake - Received SYN-ACK from origin ${event.origin} which did not match expected origin ${this._parentOrigin}`
        );
        return;
      }
    }

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  private _handleMessageFromPort = (event: MessageEvent): void => {
    if (!event.data?.penpal) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  sendMessage = (message: PenpalMessage, transferables?: Transferable[]) => {
    if (message.penpal === MessageType.Syn) {
      const parentOriginForSyn =
        this._parentOrigin instanceof RegExp ? '*' : this._parentOrigin;
      window.parent.postMessage(message, {
        targetOrigin: parentOriginForSyn,
        transfer: [this._port2],
      });
      return;
    }

    this._port1.postMessage(message, {
      transfer: transferables,
    });
  };

  addMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.delete(callback);
  };
}

export default IframeToParentAdapter;
