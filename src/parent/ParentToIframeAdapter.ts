import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';
import getOriginFromSrc from './getOriginFromSrc';
import { PenpalMessage } from '../types';
import { MessageType } from '../enums';
import { Destructor } from '../createDestructor';
import monitorIframeRemoval from './monitorIframeRemoval';
import CommsAdapter from '../CommsAdapter';

class ParentToIframeAdapter implements CommsAdapter {
  private _iframe: HTMLIFrameElement;
  private _childOrigin: string | RegExp;
  private _validatedChildOrigin: string | undefined;
  private _log: Function;
  private _messageCallbacks: Set<(message: PenpalMessage) => void> = new Set();
  private _port: MessagePort | undefined;

  constructor(
    iframe: HTMLIFrameElement,
    childOrigin: string | RegExp | undefined,
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
    monitorIframeRemoval(iframe, destructor);

    window.addEventListener('message', this._handleMessageFromWindow);

    destructor.onDestroy(() => {
      window.removeEventListener('message', this._handleMessageFromWindow);
      this._port?.removeEventListener('message', this._handleMessageFromPort);
      this._port?.close();
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromWindow = (event: MessageEvent): void => {
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
    let originQualifies =
      this._childOrigin instanceof RegExp
        ? this._childOrigin.test(event.origin)
        : this._childOrigin === '*' || this._childOrigin === event.origin;

    if (messageType === MessageType.Syn) {
      if (originQualifies) {
        this._validatedChildOrigin = event.origin;
        this._port = event.ports[0];
      } else {
        this._log(
          `Parent: Handshake - Received SYN message from origin ${event.origin} which did not match expected origin ${this._childOrigin}`
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

  sendMessage = (
    message: PenpalMessage,
    transferables?: Transferable[]
  ): void => {
    const { penpal: messageType } = message;

    if (messageType === MessageType.SynAck) {
      this._port?.addEventListener('message', this._handleMessageFromPort);
      this._port?.start();

      if (!this._validatedChildOrigin) {
        // This should never be the case.
        throw new Error('Child origin has not been validated');
      }

      // If the child origin is "null", the remote protocol is file: or data: and we
      // must post messages with "*" as the targetOrigin when using postMessage().
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#Using_window.postMessage_in_extensions
      const originForSending =
        this._validatedChildOrigin === 'null'
          ? '*'
          : this._validatedChildOrigin;

      // We have to send the SynAck message through the iframe window and not
      // the MessagePort because when the event is sent through MessagePort,
      // event.origin will always be empty when the child receives the event.
      // This is insufficient, because the child needs to validate that the
      // event's origin matches options.parentOrigin before continuing the handshake.
      this._iframe.contentWindow?.postMessage(message, originForSending);
      return;
    }

    this._port?.postMessage(message, {
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
