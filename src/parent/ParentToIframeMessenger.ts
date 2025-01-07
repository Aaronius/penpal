import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';
import getOriginFromSrc from './getOriginFromSrc';
import { Log, PenpalMessage, Destructor } from '../types';
import { MessageType } from '../enums';
import monitorIframeRemoval from './monitorIframeRemoval';
import Messenger from '../Messenger';
import namespace from '../namespace';

class ParentToIframeMessenger implements Messenger {
  private _iframe: HTMLIFrameElement;
  private _childOrigin: string | RegExp;
  private _validatedChildOrigin?: string;
  private _channel?: string;
  private _log: Log;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port?: MessagePort;

  constructor(
    iframe: HTMLIFrameElement,
    childOrigin: string | RegExp | undefined,
    channel: string | undefined,
    log: Log,
    destructor: Destructor
  ) {
    this._iframe = iframe;
    this._channel = channel;
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
      this._clearPort();
      this._messageCallbacks.clear();
    });
  }

  private _clearPort = () => {
    this._port?.removeEventListener('message', this._handleMessageFromPort);
    this._port?.close();
    this._port = undefined;
  };

  private _handleMessageFromWindow = (event: MessageEvent): void => {
    // Under specific timing circumstances, we can receive an event
    // whose source is null. This seems to happen when the child iframe is
    // removed from the DOM about the same time it sends a message.
    // https://github.com/Aaronius/penpal/issues/85
    if (
      !event.source ||
      event.source !== this._iframe.contentWindow ||
      event.data?.namespace !== namespace ||
      event.data?.channel !== this._channel
    ) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;
    const { type: messageType } = penpalMessage;

    if (messageType === MessageType.Syn) {
      const originQualifies =
        this._childOrigin instanceof RegExp
          ? this._childOrigin.test(event.origin)
          : this._childOrigin === '*' || this._childOrigin === event.origin;
      if (originQualifies) {
        this._clearPort();
        this._validatedChildOrigin = event.origin;
      } else {
        this._log(
          `Parent: Handshake - Received SYN message from origin ${event.origin} which did not match expected origin ${this._childOrigin}`
        );
        return;
      }
    }

    if (messageType === MessageType.Ack) {
      this._port = event.ports[0];

      if (!this._port) {
        throw new Error('Parent: Handshake - No port received on ACK');
      }

      this._port.addEventListener('message', this._handleMessageFromPort);
      this._port.start();
    }

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  private _handleMessageFromPort = (event: MessageEvent): void => {
    if (
      event.data?.namespace !== namespace ||
      event.data?.channel !== this._channel
    ) {
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
    const { type: messageType } = message;

    if (messageType === MessageType.SynAck) {
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

    if (this._port) {
      this._port.postMessage(message, {
        transfer: transferables,
      });
    } else {
      this._log(`Parent: Unable to send message during handshake`, message);
    }
  };

  addMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.delete(callback);
  };
}

export default ParentToIframeMessenger;
