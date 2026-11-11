import type { Message, Log, PenpalTransferable } from '../types.js';

/** Receives a message that has passed validateReceivedMessage. */
export type MessageHandler = (message: Message) => void;

export type InitializeMessengerOptions = {
  /** Optional function for logging messages that help debug communication. */
  log?: Log | undefined;
  /**
   * Checks whether a received value is a Penpal message for this connection.
   * Pass the value to onMessage only if this returns true.
   */
  validateReceivedMessage: (data: unknown) => data is Message;
  /** Call synchronously for each incoming message that passes validation. */
  onMessage: MessageHandler;
  /**
   * Call when the remote has permanently stopped, such as when a Node worker
   * exits. Penpal closes the connection and rejects pending calls. This can
   * also be called during initialization if communication is already impossible.
   */
  onDisconnect?: (() => void) | undefined;
};

/** Sends and receives Penpal messages between the two sides of a connection. */
export default interface Messenger {
  /**
   * Sends a message to the remote. Pass any transferables to the underlying
   * messaging mechanism so their ownership moves to the recipient.
   * Throw if the message cannot be sent.
   */
  sendMessage: (message: Message, transferables?: PenpalTransferable[]) => void;
  /**
   * Saves the callbacks supplied by Penpal and starts listening for messages.
   * connect() calls this before starting the handshake.
   */
  initialize: (options: InitializeMessengerOptions) => void;
  /**
   * Removes listeners, clears callbacks, and releases messaging resources
   * owned by this messenger. Penpal calls this when the connection closes.
   */
  destroy: () => void;
}
