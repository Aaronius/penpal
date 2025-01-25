import { Log, PenpalMessage, PenpalMessageEnvelope } from './types';
import Messenger, { MessageHandler } from './Messenger';
import namespace from './namespace';
import {
  downgradeMessageEnvelope,
  isDeprecatedMessage,
  upgradeMessage,
} from './backwardCompatibility';
import {
  isAckMessage,
  isPenpalMessageEnvelope,
  isSynAckMessage,
  isSynMessage,
} from './guards';
import PenpalError from './PenpalError';
import { ErrorCode } from './enums';
import {
  logReceivedMessage,
  logSendingMessage,
  LOG_MESSAGE_CONNECTION_CLOSED,
} from './commonLogging';

type Options = {
  /**
   * The window with which the current window will communicate.
   */
  remoteWindow: Window;
  /**
   * The origin of the child window. Communication will be restricted to
   * this origin. You may use a value of `*` to not restrict communication to
   * a particular origin, but beware of the risks of doing so.
   *
   * Defaults to the value of `window.origin`.
   */
  remoteOrigin?: string | RegExp;
  /**
   * A string identifier that restricts communication to a specific channel.
   * This is only useful when setting up multiple, parallel connections
   * between a parent window and a child window.
   */
  channel?: string;
  /**
   * A function for logging debug messages. When provided, messages will
   * be logged.
   */
  log?: Log;
};

/**
 * Handles the details of communicating with a child window.
 */
class WindowMessenger implements Messenger {
  private _remoteWindow: Window;
  private _remoteOrigin: string | RegExp;
  private _log?: Log;
  private _channel?: string;
  private _concreteRemoteOrigin?: string;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port?: MessagePort;
  private _isChildUsingDeprecatedProtocol = false;

  constructor({
    remoteWindow,
    remoteOrigin = window.origin,
    channel,
    log,
  }: Options) {
    if (!remoteWindow) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'remoteWindow must be defined'
      );
    }

    this._remoteWindow = remoteWindow;
    this._remoteOrigin = remoteOrigin;
    this._channel = channel;
    this._log = log;

    window.addEventListener('message', this._handleMessageFromRemoteWindow);
  }

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessageFromPort);
    this._port?.close();
    this._port = undefined;
  };

  private _isEventFromValidOrigin(event: MessageEvent): boolean {
    if (event.currentTarget instanceof MessagePort) {
      return true;
    }
    return this._remoteOrigin instanceof RegExp
      ? this._remoteOrigin.test(event.origin)
      : this._remoteOrigin === '*' || this._remoteOrigin === event.origin;
  }

  private _handleMessageFromRemoteWindow = (event: MessageEvent): void => {
    if (
      // Under specific timing circumstances, we can receive an event
      // whose source is null at this point. This seems to happen when the
      // child iframe is removed from the DOM about the same time it
      // sends a message.
      // https://github.com/Aaronius/penpal/issues/85
      !event.source ||
      event.source !== this._remoteWindow
    ) {
      return;
    }

    let envelope: PenpalMessageEnvelope;

    if (isPenpalMessageEnvelope(event.data)) {
      envelope = event.data;
    } else if (isDeprecatedMessage(event.data)) {
      this._log?.(
        'Please upgrade the child window to the latest version of Penpal.'
      );
      this._isChildUsingDeprecatedProtocol = true;
      envelope = upgradeMessage(event.data);
    } else {
      // The received event doesn't pertain to Penpal.
      return;
    }

    const { channel, message } = envelope;

    if (channel !== this._channel) {
      return;
    }

    if (!this._isEventFromValidOrigin(event)) {
      this._log?.(
        `Received a message from origin "${event.origin}" which did not match expected origin "${this._remoteOrigin}"`
      );
      return;
    }

    logReceivedMessage(envelope, this._log);

    if (isSynMessage(message)) {
      // We destroy the port if one is already set, because it's possible a
      // child is re-connecting and we'll receive a new port.
      this._destroyPort();
      this._concreteRemoteOrigin = event.origin;
    }

    if (isSynAckMessage(message)) {
      this._concreteRemoteOrigin = event.origin;
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
        throw new Error('No port received on ACK');
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
    if (!isPenpalMessageEnvelope(event.data)) {
      return;
    }

    const envelope = event.data;
    const { channel, message } = envelope;

    if (channel !== this._channel) {
      return;
    }

    logReceivedMessage(envelope, this._log);

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

    logSendingMessage(envelope, this._log);

    if (isSynMessage(message)) {
      const originForSending =
        this._remoteOrigin instanceof RegExp ? '*' : this._remoteOrigin;
      this._remoteWindow.postMessage(envelope, {
        targetOrigin: originForSending,
        transfer: transferables,
      });
      return;
    }

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

      if (!this._concreteRemoteOrigin) {
        // If this ever happens, it's a bug in Penpal.
        throw new Error('Concrete child origin not set');
      }

      const originForSending =
        this._remoteOrigin instanceof RegExp
          ? this._concreteRemoteOrigin
          : this._remoteOrigin;
      this._remoteWindow.postMessage(payload, {
        targetOrigin: originForSending,
        transfer: transferables,
      });
      return;
    }

    if (isAckMessage(message)) {
      const { port1, port2 } = new MessageChannel();
      this._port = port1;
      port1.addEventListener('message', this._handleMessageFromPort);
      port1.start();

      const transferablesToSend = [port2, ...(transferables || [])];
      if (!this._concreteRemoteOrigin) {
        // If this ever happens, it's a bug in Penpal.
        throw new Error('Concrete child origin not set');
      }

      const originForSending =
        this._remoteOrigin instanceof RegExp
          ? this._concreteRemoteOrigin
          : this._remoteOrigin;
      this._remoteWindow.postMessage(envelope, {
        targetOrigin: originForSending,
        transfer: transferablesToSend,
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

  close = () => {
    window.removeEventListener('message', this._handleMessageFromRemoteWindow);
    this._destroyPort();
    this._messageCallbacks.clear();
    this._log?.(LOG_MESSAGE_CONNECTION_CLOSED);
  };
}

export default WindowMessenger;
