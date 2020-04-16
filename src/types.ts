import { ErrorCode, MessageType, Resolution } from './enums';

export type WindowsInfo = {
  /**
   * A friendly name for the local window.
   */
  localName: 'Parent' | 'Child';

  /**
   * The local window.
   */
  local: Window;

  /**
   * The remote window.
   */
  remote: Window;

  /**
   * Origin that should be used for sending messages to the remote window.
   */
  originForSending: string;

  /**
   * Origin that should be used for receiving messages from the remote window.
   */
  originForReceiving: string;
};

/**
 * Methods to expose to the remote window.
 */
export type Methods = {
  [index: string]: Function;
};

/**
 * A method call message.
 */
export type CallMessage = {
  penpal: MessageType.Call;
  id: number;
  methodName: string;
  args: any[];
};

/**
 * A method response message.
 */
export type ReplyMessage = {
  penpal: MessageType.Reply;
  id: number;
  resolution: Resolution;
  returnValue: any;
  returnValueIsError?: boolean;
};

/**
 * A SYN handshake message.
 */
export type SynMessage = {
  penpal: MessageType.Syn;
};

/**
 * A SYN-ACK handshake message.
 */
export type SynAckMessage = {
  penpal: MessageType.SynAck;
  methodNames: string[];
};

/**
 * An ACK handshake message.
 */
export type AckMessage = {
  penpal: MessageType.Ack;
  methodNames: string[];
};

/**
 * Methods that may be called that will invoke methods on the remote window.
 */
export type CallSender = {
  [index: string]: Function;
};

/**
 * A Penpal-specific error.
 */
export type PenpalError = Error & { code: ErrorCode };
