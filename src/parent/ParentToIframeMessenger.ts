import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';
import getOriginFromSrc from './getOriginFromSrc';
import {
  Log,
  PenpalMessage,
  Destructor,
  PenpalMessageEnvelope,
} from '../types';
import { MessageType } from '../enums';
import monitorIframeRemoval from './monitorIframeRemoval';
import Messenger from '../Messenger';
import namespace from '../namespace';
import {
  DeprecatedPenpalMessage,
  downgradeMessageEnvelope,
  isDeprecatedMessage,
  upgradeMessage,
} from '../backwardCompatibility';

class ParentToIframeMessenger implements Messenger {
  private _iframe: HTMLIFrameElement;
  private _childOrigin: string | RegExp;
  private _validatedChildOrigin?: string;
  private _channel?: string;
  private _log: Log;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port?: MessagePort;
  private _isChildUsingDeprecatedProtocol = false;

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
    if (!event.source || event.source !== this._iframe.contentWindow) {
      return;
    }

    let messageEnvelope: PenpalMessageEnvelope;

    if (event.data?.namespace === namespace) {
      messageEnvelope = event.data;
    } else if (isDeprecatedMessage(event.data)) {
      this._log(
        'Parent: The child is using an older version of Penpal which will be ' +
          'incompatible when the parent upgrades to the next major version of ' +
          'Penpal. Please upgrade the child to the latest version of Penpal.'
      );

      this._isChildUsingDeprecatedProtocol = true;
      messageEnvelope = upgradeMessage(event.data as DeprecatedPenpalMessage);
    } else {
      // The received event doesn't pertain to Penpal.
      return;
    }

    if (messageEnvelope.channel !== this._channel) {
      return;
    }

    const { message } = messageEnvelope;

    if (message.type === MessageType.Syn) {
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

    if (
      message.type === MessageType.Ack &&
      // Previous versions of Penpal don't use MessagePorts so they won't be
      // sending a MessagePort on the event. We instead do all communication
      // through the window rather than a port.
      !this._isChildUsingDeprecatedProtocol
    ) {
      this._port = event.ports[0];

      if (!this._port) {
        throw new Error('Parent: Handshake - No port received on ACK');
      }

      this._port.addEventListener('message', this._handleMessageFromPort);
      this._port.start();
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  private _handleMessageFromPort = (event: MessageEvent): void => {
    // Unlike in _handleMessageFromWindow, we don't have to check if
    // the message is from a deprecated version of Penpal because older versions
    // of Penpal don't use MessagePorts.
    if (event.data?.namespace !== namespace) {
      return;
    }

    const { channel, message } = event.data as PenpalMessageEnvelope;

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

    if (
      message.type === MessageType.SynAck ||
      // If the child is using a previous version of Penpal, we need to
      // downgrade the message and send it through the window rather than
      // the port because older versions of Penpal don't use MessagePorts.
      this._isChildUsingDeprecatedProtocol
    ) {
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

      const payload = this._isChildUsingDeprecatedProtocol
        ? downgradeMessageEnvelope(envelope)
        : envelope;

      // We have to send the SynAck message through the iframe window and not
      // the MessagePort because if the event were sent through MessagePort,
      // event.origin would always be empty when the child receives the event.
      // This is insufficient, because the child needs to validate that the
      // event's origin matches the child's options.parentOrigin before
      // continuing the handshake.
      this._iframe.contentWindow?.postMessage(payload, {
        targetOrigin: originForSending,
        transfer: transferables,
      });
      return;
    }

    if (this._port) {
      this._port.postMessage(envelope, {
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
