import { Log, Message } from '../types.js';
import Messenger, {
  InitializeMessengerOptions,
  MessageHandler,
} from './Messenger.js';
import {
  downgradeMessage,
  isDeprecatedMessage,
  upgradeMessage,
} from '../backwardCompatibility.js';
import { isAck2Message, isAck1Message, isSynMessage } from '../guards.js';
import PenpalError from '../PenpalError.js';
import PenpalBugError from '../PenpalBugError.js';

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
  readonly #remoteWindow: Window;
  readonly #allowedOrigins: [string | RegExp, ...(string | RegExp)[]];
  #log?: Log;
  #validateReceivedMessage?: (data: unknown) => data is Message;
  #concreteRemoteOrigin?: string;
  #messageCallbacks = new Set<(message: Message) => void>();
  #port?: MessagePort;
  // TODO: Used for backward-compatibility. Remove in next major version.
  #isChildUsingDeprecatedProtocol = false;

  constructor({ remoteWindow, allowedOrigins }: Options) {
    if (!remoteWindow) {
      throw new PenpalError('INVALID_ARGUMENT', 'remoteWindow must be defined');
    }

    this.#remoteWindow = remoteWindow;
    this.#allowedOrigins = allowedOrigins?.length
      ? (allowedOrigins as [string | RegExp, ...(string | RegExp)[]])
      : [window.origin];
  }

  initialize = ({
    log,
    validateReceivedMessage,
  }: InitializeMessengerOptions) => {
    this.#log = log;
    this.#validateReceivedMessage = validateReceivedMessage;
    window.addEventListener('message', this.#handleMessageFromRemoteWindow);
  };

  sendMessage = (message: Message, transferables?: Transferable[]): void => {
    if (isSynMessage(message)) {
      const originForSending = this.#getOriginForSendingMessage(message);
      this.#remoteWindow.postMessage(message, {
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
      this.#isChildUsingDeprecatedProtocol
    ) {
      const payload = this.#isChildUsingDeprecatedProtocol
        ? downgradeMessage(message)
        : message;
      const originForSending = this.#getOriginForSendingMessage(message);
      this.#remoteWindow.postMessage(payload, {
        targetOrigin: originForSending,
        transfer: transferables,
      });
      return;
    }

    if (isAck2Message(message)) {
      const { port1, port2 } = new MessageChannel();
      this.#port = port1;
      port1.addEventListener('message', this.#handleMessageFromPort);
      port1.start();
      const transferablesToSend = [port2, ...(transferables || [])];
      const originForSending = this.#getOriginForSendingMessage(message);
      this.#remoteWindow.postMessage(message, {
        targetOrigin: originForSending,
        transfer: transferablesToSend,
      });
      return;
    }

    if (this.#port) {
      this.#port.postMessage(message, {
        transfer: transferables,
      });
      return;
    }

    throw new PenpalBugError('Port is undefined');
  };

  addMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: MessageHandler): void => {
    this.#messageCallbacks.delete(callback);
  };

  destroy = () => {
    window.removeEventListener('message', this.#handleMessageFromRemoteWindow);
    this.#destroyPort();
    this.#messageCallbacks.clear();
  };

  #isAllowedOrigin = (origin: string) => {
    return this.#allowedOrigins.some((allowedOrigin) =>
      allowedOrigin instanceof RegExp
        ? allowedOrigin.test(origin)
        : allowedOrigin === origin || allowedOrigin === '*'
    );
  };

  #getOriginForSendingMessage = (message: Message) => {
    // It's safe to send the SYN message to any origin because it doesn't contain
    // anything sensitive. When Penpal receives a SYN message, the origin on
    // the message (which we call the concrete origin) is validated against the
    // configured allowed origins. All subsequent messages will be sent to the
    // concrete origin.
    // If you decide to change this, consider https://github.com/Aaronius/penpal/issues/103
    if (isSynMessage(message)) {
      return '*';
    }

    if (!this.#concreteRemoteOrigin) {
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
    return this.#concreteRemoteOrigin === 'null' &&
      this.#allowedOrigins.includes('*')
      ? '*'
      : this.#concreteRemoteOrigin;
  };

  #destroyPort = () => {
    this.#port?.removeEventListener('message', this.#handleMessageFromPort);
    this.#port?.close();
    this.#port = undefined;
  };

  #handleMessageFromRemoteWindow = ({
    source,
    origin,
    ports,
    data,
  }: MessageEvent): void => {
    if (source !== this.#remoteWindow) {
      return;
    }

    // TODO: Used for backward-compatibility. Remove in next major version.
    if (isDeprecatedMessage(data)) {
      this.#log?.(
        'Please upgrade the child window to the latest version of Penpal.'
      );
      this.#isChildUsingDeprecatedProtocol = true;
      data = upgradeMessage(data);
    }

    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    if (!this.#isAllowedOrigin(origin)) {
      this.#log?.(
        `Received a message from origin \`${origin}\` which did not match ` +
          `allowed origins \`[${this.#allowedOrigins.join(', ')}]\``
      );
      return;
    }

    if (isSynMessage(data)) {
      // If we receive a SYN message and already have a port, it means
      // the child is re-connecting, in which case we'll receive a new port.
      // For this reason, we always make sure we destroy the existing port.
      this.#destroyPort();
      this.#concreteRemoteOrigin = origin;
    }

    if (
      isAck2Message(data) &&
      // Previous versions of Penpal don't use MessagePorts and do all
      // communication through the window.
      !this.#isChildUsingDeprecatedProtocol
    ) {
      this.#port = ports[0];

      if (!this.#port) {
        throw new PenpalBugError('No port received on ACK2');
      }

      this.#port.addEventListener('message', this.#handleMessageFromPort);
      this.#port.start();
    }

    for (const callback of this.#messageCallbacks) {
      callback(data);
    }
  };

  #handleMessageFromPort = ({ data }: MessageEvent): void => {
    // Unlike in _handleMessageFromWindow, we don't need to check if
    // the message is from a deprecated version of Penpal because older versions
    // of Penpal don't use MessagePorts.
    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    for (const callback of this.#messageCallbacks) {
      callback(data);
    }
  };
}

export default WindowMessenger;
