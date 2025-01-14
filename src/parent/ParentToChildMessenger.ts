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

/**
 * Handles communication between the parent and a remote (either an iframe or a worker).
 */
class ParentToChildMessenger implements Messenger {
  private _child: HTMLIFrameElement | Worker;
  private _childOrigin: string | RegExp | undefined;
  private _validatedChildOrigin?: string;
  private _channel?: string;
  private _log: Log;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port?: MessagePort;
  private _isChildUsingDeprecatedProtocol = false;

  constructor(
    child: HTMLIFrameElement | Worker,
    childOrigin: string | RegExp | undefined,
    channel: string | undefined,
    log: Log,
    destructor: Destructor
  ) {
    this._child = child;
    this._channel = channel;
    this._log = log;

    let messageDispatcher: Worker | Window;

    if (child instanceof Worker) {
      messageDispatcher = child;
    } else {
      if (!childOrigin) {
        validateIframeHasSrcOrSrcDoc(child);
        childOrigin = getOriginFromSrc(child.src);
      }
      this._childOrigin = childOrigin;
      monitorIframeRemoval(child, destructor);
      messageDispatcher = window;
    }

    messageDispatcher.addEventListener(
      'message',
      this._handleMessageFromChild as EventListener
    );

    destructor.onDestroy(() => {
      messageDispatcher.removeEventListener(
        'message',
        this._handleMessageFromChild as EventListener
      );
      this._destroyPort();
      this._messageCallbacks.clear();
    });
  }

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessageFromPort);
    this._port?.close();
    this._port = undefined;
  };

  private _handleMessageFromChild = (event: MessageEvent): void => {
    // event.source is always null when receiving an event from a worker,
    // so we don't have to check it in that case.
    if (this._child instanceof HTMLIFrameElement) {
      if (
        // Under specific timing circumstances, we can receive an event
        // whose source is null at this point. This seems to happen when the
        // child iframe is removed from the DOM about the same time it
        // sends a message.
        // https://github.com/Aaronius/penpal/issues/85
        !event.source ||
        event.source !== this._child.contentWindow
      ) {
        return;
      }
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

    if (!this._isEventFromValidOrigin(event)) {
      this._log(
        `Parent: Received a message from ${event.origin} which did not match expected origin ${this._childOrigin}`
      );
      return;
    }

    const { message } = messageEnvelope;

    if (message.type === MessageType.Syn) {
      // We destroy the port if one is already set, because it's possible a
      // child is re-connecting.
      this._destroyPort();
      this._validatedChildOrigin = event.origin;
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
        // If this ever happens, it's a bug in Penpal.
        throw new Error('Parent: Handshake - No port received on ACK');
      }

      this._port.addEventListener('message', this._handleMessageFromPort);
      this._port.start();
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  private _isEventFromValidOrigin(event: MessageEvent): boolean {
    if (
      // In both cases, origins are irrelevant.
      this._child instanceof Worker ||
      event.currentTarget instanceof MessagePort
    ) {
      return true;
    }
    return this._childOrigin instanceof RegExp
      ? this._childOrigin.test(event.origin)
      : this._childOrigin === '*' || this._childOrigin === event.origin;
  }

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
      const payload = this._isChildUsingDeprecatedProtocol
        ? downgradeMessageEnvelope(envelope)
        : envelope;

      if (this._child instanceof HTMLIFrameElement) {
        if (!this._validatedChildOrigin) {
          // If this ever happens, it's a bug in Penpal.
          throw new Error('Child origin has not been validated');
        }

        // Previous versions of Penpal don't use MessagePorts so they won't be
        // sending a MessagePort on the event. We instead do all communication
        // through the window rather than a port.
        const originForSending =
          this._validatedChildOrigin === 'null'
            ? '*'
            : this._validatedChildOrigin;

        this._child.contentWindow?.postMessage(payload, {
          targetOrigin: originForSending,
          transfer: transferables,
        });
      } else {
        this._child.postMessage(payload, {
          transfer: transferables,
        });
      }
      return;
    }

    if (this._port) {
      this._port.postMessage(envelope, {
        transfer: transferables,
      });
    } else {
      // If this ever happens, it's a bug in Penpal.
      throw new Error('Port has not been received from child');
    }
  };

  addMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.delete(callback);
  };
}

export default ParentToChildMessenger;
