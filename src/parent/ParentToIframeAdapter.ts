import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';
import getOriginFromSrc from './getOriginFromSrc';
import { PenpalMessage } from '../types';
import { MessageType } from '../enums';
import { Destructor } from '../createDestructor';
import monitorIframeRemoval from './monitorIframeRemoval';
import CommsAdapter from '../CommsAdapter';

class ParentToIframeAdapter implements CommsAdapter {
  private _iframe: HTMLIFrameElement;
  private _childOrigin: string;
  private _log: Function;
  private _originForSending: string;
  private _messageCallbacks: Set<(message: PenpalMessage) => void> = new Set();

  constructor(
    iframe: HTMLIFrameElement,
    childOrigin: string | undefined,
    log: Function,
    destructor: Destructor
  ) {
    this._iframe = iframe;
    this._log = log;

    if (!childOrigin) {
      validateIframeHasSrcOrSrcDoc(iframe);
      childOrigin = getOriginFromSrc(iframe.src);
    }

    this._childOrigin = childOrigin;
    // If event.origin is "null", the remote protocol is file: or data: and we
    // must post messages with "*" as targetOrigin when sending messages.
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#Using_window.postMessage_in_extensions
    this._originForSending = childOrigin === 'null' ? '*' : childOrigin;
    monitorIframeRemoval(iframe, destructor);

    window.addEventListener('message', this._handleMessageFromChild);

    destructor.onDestroy(() => {
      window.removeEventListener('message', this._handleMessageFromChild);
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromChild = (event: MessageEvent): void => {
    // Under specific timing circumstances, we can receive an event
    // whose source is null. This seems to happen when the child iframe is
    // removed from the DOM about the same time it sends a message.
    // https://github.com/Aaronius/penpal/issues/85
    if (
      !event.source ||
      event.source !== this._iframe.contentWindow ||
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
          `Parent received message from origin ${event.origin} which did not match expected origin ${this._childOrigin}`
        );
      }
      return;
    }

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  sendMessage = (
    message: PenpalMessage,
    transferables?: Transferable[]
  ): void => {
    this._iframe.contentWindow?.postMessage(message, {
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

export default ParentToIframeAdapter;
