import { Destructor } from '../createDestructor';
import { ErrorCode, MessageType } from '../enums';
import { PenpalError, PenpalMessage } from '../types';
import CommsAdapter from '../CommsAdapter';
import areGlobalsAccessible from '../areGlobalsAccessible';

class IframeToParentAdapter implements CommsAdapter {
  private _parentOrigin: string | RegExp;
  private _log: Function;
  private _messageCallbacks: Set<(message: PenpalMessage) => void> = new Set();
  private _port1: MessagePort;
  private _port2: MessagePort;
  private _isConnected = false;

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

    const { port1, port2 } = new MessageChannel();
    this._port1 = port1;
    this._port2 = port2;
    port1.addEventListener('message', this._handleMessageFromParent);
    port1.start();

    destructor.onDestroy(() => {
      port1.removeEventListener('message', this._handleMessageFromParent);
      port1.close();
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromParent = (event: MessageEvent): void => {
    // Under niche scenarios, we get into this function after
    // the iframe has been removed from the DOM. In Edge, this
    // results in "Object expected" errors being thrown when we
    // try to access properties on window (global properties).
    // For this reason, we try to access a global up front (clearTimeout)
    // and if it fails we can assume the iframe has been removed
    // and we ignore the message event.
    if (!areGlobalsAccessible()) {
      return;
    }

    if (event.source !== window.parent || !event.data?.penpal) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;
    const { penpal: messageType } = penpalMessage;

    if (messageType === MessageType.SynAck) {
      const originQualifies =
        this._parentOrigin instanceof RegExp
          ? this._parentOrigin.test(event.origin)
          : this._parentOrigin === '*' || this._parentOrigin === event.origin;
      if (originQualifies) {
        this._isConnected = true;
      } else {
        this._log(
          `Child: Handshake - Received SYN-ACK from origin ${event.origin} which did not match expected origin ${this._parentOrigin}`
        );
      }
      return;
    }

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
