import validateIframeHasSrcOrSrcDoc from './parent/validateIframeHasSrcOrSrcDoc';
import getOriginFromSrc from './parent/getOriginFromSrc';
import { AsyncMethodReturns, PenpalMessage, SynAckMessage } from './types';
import { MessageType } from './enums';
import { Destructor } from './createDestructor';
import monitorIframeRemoval from './parent/monitorIframeRemoval';
import CommsAdapter from './CommsAdapter';

class ParentToIframeAdapter implements CommsAdapter {
  private _child: HTMLIFrameElement;
  private _childOrigin: string;
  private _log: Function;
  private _destructor: Destructor;
  private _originForSending: string;
  private _messageCallbacks: Set<(message: PenpalMessage) => void> = new Set();

  constructor(
    child: HTMLIFrameElement,
    childOrigin: string | undefined,
    log: Function,
    destructor: Destructor
  ) {
    this._child = child;
    this._log = log;
    this._destructor = destructor;

    if (!childOrigin) {
      validateIframeHasSrcOrSrcDoc(child);
      childOrigin = getOriginFromSrc(child.src);
    }

    this._childOrigin = childOrigin;
    // If event.origin is "null", the remote protocol is file: or data: and we
    // must post messages with "*" as targetOrigin when sending messages.
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#Using_window.postMessage_in_extensions
    this._originForSending = childOrigin === 'null' ? '*' : childOrigin;
    monitorIframeRemoval(child, destructor);
  }

  sendMessageToRemote = (message: PenpalMessage): void => {
    this._child.contentWindow?.postMessage(message, this._originForSending);
  };

  private _handleMessageFromChild = (event: MessageEvent): void => {
    // Under specific timing circumstances, we can receive an event
    // whose source is null. This seems to happen when the child iframe is
    // removed from the DOM about the same time it sends a message.
    // https://github.com/Aaronius/penpal/issues/85
    if (
      !event.source ||
      event.source !== this._child.contentWindow ||
      !event.data?.penpal
    ) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;
    const { penpal: messageType } = penpalMessage;

    if (this._childOrigin !== '*' && event.origin !== this._childOrigin) {
      if (messageType === MessageType.Syn) {
        this._log(
          `Parent: Handshake - Received SYN message from origin ${event.origin} which did not match expected origin ${this._childOrigin}`
        );
      }
      if (messageType === MessageType.Ack) {
        this._log(
          `Parent: Handshake - Received ACK message from origin ${event.origin} which did not match expected origin ${this._childOrigin}`
        );
      }
      if (
        messageType === MessageType.Call ||
        messageType === MessageType.Reply
      ) {
        this._log(
          `Parent received message from origin ${event.origin} which did not match expected origin`
        );
        // this._log(
        //     `Parent received message from origin ${event.origin} which did not match expected origin ${originForReceiving}`
        // );
      }
      return;
    }

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  listenForMessagesFromRemote = (
    callback: (message: PenpalMessage) => void
  ): void => {
    if (!this._messageCallbacks.size) {
      window.addEventListener('message', this._handleMessageFromChild);
    }

    this._messageCallbacks.add(callback);
  };

  stopListeningForMessagesFromRemote = (
    callback: (message: PenpalMessage) => void
  ): void => {
    this._messageCallbacks.delete(callback);

    if (!this._messageCallbacks.size) {
      window.removeEventListener('message', this._handleMessageFromChild);
    }
  };
}

export default ParentToIframeAdapter;
