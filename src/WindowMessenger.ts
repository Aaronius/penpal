import { Log, Message, Envelope } from './types';
import Messenger, { InitializeOptions, MessageHandler } from './Messenger';
import {
  downgradeEnvelope,
  isDeprecatedMessage,
  upgradeMessage,
} from './backwardCompatibility';
import {
  isAck2Message,
  isEnvelope,
  isAck1Message,
  isSynMessage,
} from './guards';
import PenpalError from './PenpalError';
import { ErrorCode } from './enums';
import namespace from './namespace';
import PenpalBugError from './PenpalBugError';

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
  /**
   * A string identifier that disambiguates communication when establishing
   * multiple, parallel connections for a single iframe. This is uncommon.
   * The same channel identifier must be specified on both `connectToChild` and
   * `connectToParent` in order for the connection between the two to be
   * established.
   */
  channel?: string;
};

/**
 * Handles the details of communicating with a child window.
 */
class WindowMessenger implements Messenger {
  private _remoteWindow: Window;
  private _allowedOrigins: [string | RegExp, ...(string | RegExp)[]];
  private _log?: Log;
  private _channel?: string;
  private _concreteRemoteOrigin?: string;
  private _messageCallbacks = new Set<(message: Message) => void>();
  private _port?: MessagePort;
  private _isChildUsingDeprecatedProtocol = false;

  constructor({ remoteWindow, allowedOrigins, channel }: Options) {
    if (!remoteWindow) {
      throw new PenpalError(
        ErrorCode.InvalidArgument,
        'remoteWindow must be defined'
      );
    }

    this._remoteWindow = remoteWindow;
    this._allowedOrigins =
      allowedOrigins && allowedOrigins.length
        ? (allowedOrigins as [string | RegExp, ...(string | RegExp)[]])
        : [window.origin];
    this._channel = channel;
  }

  initialize = ({ log }: InitializeOptions) => {
    this._log = log;
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

    let envelope: Envelope;

    if (isEnvelope(event.data)) {
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

    if (!this._isAllowedOrigin(event.origin)) {
      this._log?.(
        `Received a message from origin \`${
          event.origin
        }\` which did not match allowed origins \`[${this._allowedOrigins.join(
          ', '
        )}]\``
      );
      return;
    }

    if (isSynMessage(message)) {
      // If we receive a SYN message and already have a port, it means
      // the child is re-connecting, in which case we'll receive a new port.
      // For this reason, we always make sure we destroy the existing port
      this._destroyPort();
      this._concreteRemoteOrigin = event.origin;
    }

    if (isAck1Message(message)) {
      this._concreteRemoteOrigin = event.origin;
    }

    if (
      isAck2Message(message) &&
      // Previous versions of Penpal don't use MessagePorts so they wouldn't be
      // sending a MessagePort on the event. In that case, we instead do all
      // communication through the window rather than a port.
      !this._isChildUsingDeprecatedProtocol
    ) {
      this._port = event.ports[0];

      if (!this._port) {
        throw new PenpalBugError('No port received on ACK2');
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
    if (!isEnvelope(event.data)) {
      return;
    }

    const envelope = event.data;
    const { channel, message } = envelope;

    if (channel !== this._channel) {
      return;
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    const envelope: Envelope = {
      namespace,
      channel: this._channel,
      message,
    };

    if (isSynMessage(message)) {
      const originForSending = this._getOriginForSendingMessage(message);
      this._remoteWindow.postMessage(envelope, {
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
        ? downgradeEnvelope(envelope)
        : envelope;
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
      throw new PenpalBugError('Port is undefined');
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
  };
}

export default WindowMessenger;
