import { Log, PenpalMessage, PenpalMessageEnvelope } from '../types';
import Messenger, { InitializeOptions, MessageHandler } from '../Messenger';
import namespace from '../namespace';
import {
  downgradeMessageEnvelope,
  isDeprecatedMessage,
  upgradeMessage,
} from '../backwardCompatibility';
import {
  isAckMessage,
  isPenpalMessageEnvelope,
  isSynAckMessage,
  isSynMessage,
  isWindow,
} from '../guards';
import PenpalError from '../PenpalError';
import { ErrorCode } from '../enums';

type Options = {
  /**
   * The child window with which the parent will communicate.
   */
  childWindow: Window | (() => Window);
  /**
   * The origin of the child window. Communication will be restricted to
   * this origin. You may use a value of `*` to not restrict communication to
   * a particular origin, but beware of the risks of doing so.
   *
   * Defaults to the value of `window.origin`.
   */
  childOrigin?: string | RegExp;
  /**
   * A string identifier that locks down communication to a child window
   * attempting to connect on the same channel.
   */
  channel?: string;
};

/**
 * Handles the details of communicating with a child window.
 */
class ParentToChildWindowMessenger implements Messenger {
  private _childWindow: Window | (() => Window);
  private _cachedChildWindow?: Window;
  private _childOrigin: string | RegExp;
  private _channel?: string;
  private _concreteChildOrigin?: string;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port?: MessagePort;
  private _isChildUsingDeprecatedProtocol = false;
  private _log?: Log;

  constructor({ childWindow, childOrigin = window.origin, channel }: Options) {
    if (
      !childWindow ||
      (!isWindow(childWindow) && !(typeof childWindow === 'function'))
    ) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'childWindow must be a Window or function that returns a Window'
      );
    }

    this._childWindow = childWindow;
    this._childOrigin = childOrigin;
    this._channel = channel;

    window.addEventListener('message', this._handleMessageFromChild);
  }

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessageFromPort);
    this._port?.close();
    this._port = undefined;
  };

  private _getDefinedChildWindow = () => {
    if (!this._cachedChildWindow) {
      if (isWindow(this._childWindow)) {
        this._cachedChildWindow = this._childWindow;
      } else {
        const childWindow = this._childWindow();

        if (!isWindow(childWindow)) {
          throw new PenpalError(
            ErrorCode.InvalidArgument,
            'childWindow did not return a Window object'
          );
        }

        this._cachedChildWindow = childWindow;
      }
    }

    return this._cachedChildWindow;
  };

  private _handleMessageFromChild = (event: MessageEvent): void => {
    if (
      // Under specific timing circumstances, we can receive an event
      // whose source is null at this point. This seems to happen when the
      // child iframe is removed from the DOM about the same time it
      // sends a message.
      // https://github.com/Aaronius/penpal/issues/85
      !event.source ||
      event.source !== this._getDefinedChildWindow()
    ) {
      return;
    }

    let messageEnvelope: PenpalMessageEnvelope;

    if (isPenpalMessageEnvelope(event.data)) {
      messageEnvelope = event.data;
    } else if (isDeprecatedMessage(event.data)) {
      this._log?.(
        'Please upgrade the child window to the latest version of Penpal.'
      );
      this._isChildUsingDeprecatedProtocol = true;
      messageEnvelope = upgradeMessage(event.data);
    } else {
      // The received event doesn't pertain to Penpal.
      return;
    }

    if (messageEnvelope.channel !== this._channel) {
      return;
    }

    if (!this._isEventFromValidOrigin(event)) {
      this._log?.(
        `Received a message from origin "${event.origin}" which did not match expected origin "${this._childOrigin}"`
      );
      return;
    }

    const { message } = messageEnvelope;

    if (isSynMessage(message)) {
      // We destroy the port if one is already set, because it's possible a
      // child is re-connecting and we'll receive a new port.
      this._destroyPort();
      this._concreteChildOrigin = event.origin;
    }

    if (
      isAckMessage(message) &&
      // Previous versions of Penpal don't use MessagePorts so they won't be
      // sending a MessagePort on the event. We instead do all communication
      // through the window rather than a port.
      !this._isChildUsingDeprecatedProtocol
    ) {
      this._port = event.ports[0];

      if (!this._port) {
        // If this ever happens, it's a bug in Penpal.
        throw new Error('Handshake - No port received on ACK');
      }

      this._port.addEventListener('message', this._handleMessageFromPort);
      this._port.start();
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  private _isEventFromValidOrigin(event: MessageEvent): boolean {
    if (event.currentTarget instanceof MessagePort) {
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
    if (!isPenpalMessageEnvelope(event.data)) {
      return;
    }

    const { channel, message } = event.data;

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
      isSynAckMessage(message) ||
      // If the child is using a previous version of Penpal, we need to
      // downgrade the message and send it through the window rather than
      // the port because older versions of Penpal don't use MessagePorts.
      this._isChildUsingDeprecatedProtocol
    ) {
      const payload = this._isChildUsingDeprecatedProtocol
        ? downgradeMessageEnvelope(envelope)
        : envelope;

      if (!this._concreteChildOrigin) {
        // If this ever happens, it's a bug in Penpal.
        throw new Error('Concrete child origin not set');
      }

      const originForSending =
        this._childOrigin instanceof RegExp
          ? this._concreteChildOrigin
          : this._childOrigin;
      this._getDefinedChildWindow().postMessage(payload, {
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
      // If this ever happens, it's a bug in Penpal.
      throw new Error('Port has not been received from child');
    }
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.delete(callback);
  };

  initialize = ({ log }: InitializeOptions) => {
    this._log = log;
  };

  close = () => {
    window.removeEventListener('message', this._handleMessageFromChild);
    this._destroyPort();
    this._messageCallbacks.clear();
  };
}

export default ParentToChildWindowMessenger;
