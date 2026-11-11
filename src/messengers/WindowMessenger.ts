import type {
  Log,
  Message,
  MessageEventLike,
  MessagePortLike,
  PenpalTransferable,
} from '../types.js';
import type Messenger from './Messenger.js';
import type {
  InitializeMessengerOptions,
  MessageHandler,
} from './Messenger.js';
import { isAck2Message, isAck1Message, isSynMessage } from '../guards.js';
import PenpalError from '../PenpalError.js';

// Keep this structural so generated .d.ts files don't reference the DOM-only
// Window global. Penpal also supports worker-only projects, and those projects
// should be able to type-check the package without adding "dom" to tsconfig libs
// just because WindowMessenger is one of Penpal's exports.
type WindowLike = {
  postMessage: (
    message: unknown,
    options?: {
      targetOrigin?: string;
      transfer?: PenpalTransferable[];
    },
  ) => void;
};

type WindowMessengerOptions = {
  /**
   * The window with which the current window will communicate.
   */
  remoteWindow: WindowLike;
  /**
   * An array of strings or regular expressions defining to which origins
   * communication will be allowed. If not provided, communication will be
   * restricted to the origin of the current page. You may specify an allowed
   * origin of `*` to not restrict communication, but beware the risks of
   * doing so.
   */
  allowedOrigins?: (string | RegExp)[] | undefined;
};

/**
 * Handles the details of communicating with a child window.
 */
class WindowMessenger implements Messenger {
  readonly #remoteWindow: WindowLike;
  readonly #allowedOrigins: readonly (string | RegExp)[];
  #log: Log | undefined;
  #validateReceivedMessage: ((data: unknown) => data is Message) | undefined;
  #concreteRemoteOrigin: string | undefined;
  #onMessage: MessageHandler | undefined;
  #port: MessagePortLike | undefined;

  constructor({ remoteWindow, allowedOrigins }: WindowMessengerOptions) {
    if (!remoteWindow) {
      throw new PenpalError('INVALID_ARGUMENT', 'remoteWindow must be defined');
    }

    this.#remoteWindow = remoteWindow;
    this.#allowedOrigins = allowedOrigins?.length
      ? allowedOrigins
      : [window.origin];
  }

  initialize = ({
    log,
    validateReceivedMessage,
    onMessage,
  }: InitializeMessengerOptions): void => {
    this.#log = log;
    this.#validateReceivedMessage = validateReceivedMessage;
    this.#onMessage = onMessage;
    window.addEventListener('message', this.#handleMessageFromRemoteWindow);
  };

  sendMessage = (
    message: Message,
    transferables?: PenpalTransferable[],
  ): void => {
    if (isSynMessage(message)) {
      const originForSending = this.#getOriginForSendingMessage(message);
      this.#remoteWindow.postMessage(message, {
        targetOrigin: originForSending,
        ...(transferables === undefined ? {} : { transfer: transferables }),
      });
      return;
    }

    if (isAck1Message(message)) {
      const originForSending = this.#getOriginForSendingMessage(message);
      this.#remoteWindow.postMessage(message, {
        targetOrigin: originForSending,
        ...(transferables === undefined ? {} : { transfer: transferables }),
      });
      return;
    }

    if (isAck2Message(message)) {
      const originForSending = this.#getOriginForSendingMessage(message);
      const { port1, port2 } = new MessageChannel();
      this.#setPort(port1);
      const transferablesToSend = [port2, ...(transferables || [])];

      try {
        this.#remoteWindow.postMessage(message, {
          targetOrigin: originForSending,
          transfer: transferablesToSend,
        });
      } catch (error) {
        this.#destroyPort();
        port2.close();
        throw error;
      }

      return;
    }

    if (this.#port) {
      this.#port.postMessage(message, transferables);
      return;
    }

    throw new PenpalError(
      'TRANSMISSION_FAILED',
      'Cannot send message because the MessagePort is not connected',
    );
  };

  destroy = (): void => {
    this.#validateReceivedMessage = undefined;
    this.#onMessage = undefined;
    window.removeEventListener('message', this.#handleMessageFromRemoteWindow);
    this.#destroyPort();
  };

  #isAllowedOrigin = (origin: string) => {
    return this.#allowedOrigins.some((allowedOrigin) => {
      if (allowedOrigin instanceof RegExp) {
        // RegExp.test() mutates lastIndex for global and sticky expressions,
        // so test a copy to keep repeated handshake messages deterministic.
        return new RegExp(allowedOrigin).test(origin);
      }

      return allowedOrigin === origin || allowedOrigin === '*';
    });
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
      throw new PenpalError(
        'TRANSMISSION_FAILED',
        'Cannot send message because the remote origin is not established',
      );
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

  #setPort = (port: MessagePortLike) => {
    this.#port = port;
    this.#port.addEventListener('message', this.#handleMessageFromPort);
    this.#port.start();
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

    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    if (!this.#isAllowedOrigin(origin)) {
      this.#log?.(
        `Received a message from origin \`${origin}\` which did not match ` +
          `allowed origins \`[${this.#allowedOrigins.join(', ')}]\``,
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

    if (isAck2Message(data)) {
      const port = ports[0];

      if (!port) {
        this.#log?.('Ignoring ACK2 because it did not include a MessagePort');
        return;
      }

      this.#setPort(port);
    }

    this.#onMessage?.(data);
  };

  #handleMessageFromPort = ({ data }: MessageEventLike): void => {
    if (!this.#validateReceivedMessage?.(data)) {
      return;
    }

    this.#onMessage?.(data);
  };
}

export default WindowMessenger;
