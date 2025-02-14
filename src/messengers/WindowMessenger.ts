import { Log, Message } from '../types';
import Messenger, { InitializeOptions, MessageHandler } from './Messenger';
import {
  downgradeMessage,
  isDeprecatedMessage,
  upgradeMessage,
} from '../backwardCompatibility';
import { isAck2Message, isAck1Message, isSynMessage } from '../guards';
import PenpalError from '../PenpalError';
import { ErrorCode } from '../enums';
import PenpalBugError from '../PenpalBugError';

type Options = {
  /**
   * The window with which the current window will communicate.
   */
  remoteWindow: Window;
  /**
   * An array of strings or regular expressions defining to which origins
   * communication will be allowed. If not provided, communication will be
   * restricted to the origin of the current page. You may specify an allowed
   * origin of `*` to not restrict communication, but beware the risks of
   * doing so.
   */
  allowedOrigins?: (string | RegExp)[];
};

/**
 * Handles the details of communicating with a child window.
 */
class WindowMessenger implements Messenger {
  private _remoteWindow: Window;
  private _allowedOrigins: [string | RegExp, ...(string | RegExp)[]];
  private _log?: Log;
  private _validateReceivedMessage?: (data: unknown) => data is Message;
  private _concreteRemoteOrigin?: string;
  private _messageCallbacks = new Set<(message: Message) => void>();
  private _port?: MessagePort;
  // TODO: Used for backward-compatibility. Remove in next major version.
  private _isChildUsingDeprecatedProtocol = false;

  constructor({ remoteWindow, allowedOrigins }: Options) {
    if (!remoteWindow) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'remoteWindow must be defined'
      );
    }

    this._remoteWindow = remoteWindow;
    this._allowedOrigins = allowedOrigins?.length
      ? (allowedOrigins as [string | RegExp, ...(string | RegExp)[]])
      : [window.origin];
  }

  initialize = ({ log, validateReceivedMessage }: InitializeOptions) => {
    this._log = log;
    this._validateReceivedMessage = validateReceivedMessage;
    window.addEventListener('message', this._handleMessageFromRemoteWindow);
  };

  private _isAllowedOrigin = (origin: string) => {
    return this._allowedOrigins.some((allowedOrigin) =>
      allowedOrigin instanceof RegExp
        ? allowedOrigin.test(origin)
        : allowedOrigin === origin || allowedOrigin === '*'
    );
  };

  private _getOriginForSendingMessage = (message: Message) => {
    if (isSynMessage(message)) {
      return this._allowedOrigins.length > 1 ||
        this._allowedOrigins[0] instanceof RegExp
        ? '*'
        : this._allowedOrigins[0];
    }

    if (!this._concreteRemoteOrigin) {
      throw new PenpalBugError('Concrete remote origin not set');
    }

    // If the concrete remote origin (the origin we received from the remote
    // on a prior message) is 'null', it means the remote is within
    // an "opaque origin". The only way to post a message to an
    // opaque origin is by using '*'. This does carry some security risk,
    // so we only do this if the consumer has specifically defined '*' as
    // an allowed origin. Opaque origins occur, for example, when
    // loading an HTML document directly from the filesystem (not a
    // web server) or through a data URI.
    return this._concreteRemoteOrigin === 'null' &&
      this._allowedOrigins.includes('*')
      ? '*'
      : this._concreteRemoteOrigin;
  };

  private _destroyPort = () => {
    this._port?.removeEventListener('message', this._handleMessageFromPort);
    this._port?.close();
    this._port = undefined;
  };

  private _handleMessageFromRemoteWindow = ({
    source,
    origin,
    ports,
    data,
  }: MessageEvent): void => {
    if (source !== this._remoteWindow) {
      return;
    }

    // TODO: Used for backward-compatibility. Remove in next major version.
    if (isDeprecatedMessage(data)) {
      this._log?.(
        'Please upgrade the child window to the latest version of Penpal.'
      );
      this._isChildUsingDeprecatedProtocol = true;
      data = upgradeMessage(data);
    }

    if (!this._validateReceivedMessage?.(data)) {
      return;
    }

    if (!this._isAllowedOrigin(origin)) {
      this._log?.(
        `Received a message from origin \`${origin}\` which did not match ` +
          `allowed origins \`[${this._allowedOrigins.join(', ')}]\``
      );
      return;
    }

    if (isSynMessage(data)) {
      // If we receive a SYN message and already have a port, it means
      // the child is re-connecting, in which case we'll receive a new port.
      // For this reason, we always make sure we destroy the existing port.
      this._destroyPort();
      this._concreteRemoteOrigin = origin;
    }

    if (
      isAck2Message(data) &&
      // Previous versions of Penpal don't use MessagePorts and do all
      // communication through the window.
      !this._isChildUsingDeprecatedProtocol
    ) {
      this._port = ports[0];

      if (!this._port) {
        throw new PenpalBugError('No port received on ACK2');
      }

      this._port.addEventListener('message', this._handleMessageFromPort);
      this._port.start();
    }

    for (const callback of this._messageCallbacks) {
      callback(data);
    }
  };

  private _handleMessageFromPort = ({ data }: MessageEvent): void => {
    // Unlike in _handleMessageFromWindow, we don't need to check if
    // the message is from a deprecated version of Penpal because older versions
    // of Penpal don't use MessagePorts.
    if (!this._validateReceivedMessage?.(data)) {
      return;
    }

    for (const callback of this._messageCallbacks) {
      callback(data);
    }
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    if (isSynMessage(message)) {
      const originForSending = this._getOriginForSendingMessage(message);
      this._remoteWindow.postMessage(message, {
        targetOrigin: originForSending,
        transfer: transferables,
      });
      return;
    }

    if (
      isAck1Message(message) ||
      // If the child is using a previous version of Penpal, we need to
      // downgrade the message and send it through the window rather than
      // the port because older versions of Penpal don't use MessagePorts.
      this._isChildUsingDeprecatedProtocol
    ) {
      const payload = this._isChildUsingDeprecatedProtocol
        ? downgradeMessage(message)
        : message;
      const originForSending = this._getOriginForSendingMessage(message);
      this._remoteWindow.postMessage(payload, {
        targetOrigin: originForSending,
        transfer: transferables,
      });
      return;
    }

    if (isAck2Message(message)) {
      const { port1, port2 } = new MessageChannel();
      this._port = port1;
      port1.addEventListener('message', this._handleMessageFromPort);
      port1.start();
      const transferablesToSend = [port2, ...(transferables || [])];
      const originForSending = this._getOriginForSendingMessage(message);
      this._remoteWindow.postMessage(message, {
        targetOrigin: originForSending,
        transfer: transferablesToSend,
      });
      return;
    }

    if (this._port) {
      this._port.postMessage(message, {
        transfer: transferables,
      });
      return;
    }

    throw new PenpalBugError('Port is undefined');
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this._messageCallbacks.delete(callback);
  };

  destroy = () => {
    window.removeEventListener('message', this._handleMessageFromRemoteWindow);
    this._destroyPort();
    this._messageCallbacks.clear();
  };
}

export default WindowMessenger;
