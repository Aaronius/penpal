import { Destructor } from '../createDestructor';
import { ErrorCode, MessageType } from '../enums';
import { PenpalError, PenpalMessage } from '../types';
import CommsAdapter from '../CommsAdapter';
import areGlobalsAccessible from '../areGlobalsAccessible';

class IframeToParentAdapter implements CommsAdapter {
  private _parentOrigin: string | RegExp;
  private _log: Function;
  private _messageCallbacks: Set<(message: PenpalMessage) => void> = new Set();
  private _originForSending: string | undefined;

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

    window.addEventListener('message', this._handleMessageFromParent);

    destructor.onDestroy(() => {
      window.removeEventListener('message', this._handleMessageFromParent);
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

    if (event.source !== parent || !event.data?.penpal) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;
    const { penpal: messageType } = penpalMessage;

    let originQualifies =
      this._parentOrigin instanceof RegExp
        ? this._parentOrigin.test(event.origin)
        : this._parentOrigin === '*' || this._parentOrigin === event.origin;

    if (messageType === MessageType.SynAck) {
      if (originQualifies) {
        // If event.origin is "null", the remote protocol is file: or data: and we
        // must post messages with "*" as targetOrigin when sending messages.
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#Using_window.postMessage_in_extensions
        this._originForSending = event.origin === 'null' ? '*' : event.origin;
      } else {
        this._log(
          `Child: Handshake - Received SYN-ACK from origin ${event.origin} which did not match expected origin ${this._parentOrigin}`
        );
      }
    }

    if (!originQualifies) {
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
        transfer: transferables,
      });
      return;
    }

    window.parent.postMessage(message, {
      targetOrigin: this._originForSending,
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
