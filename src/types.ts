import { ErrorCode, MessageType, Resolution } from './enums';


/**
 * An ACK handshake message.
 */
export type AckMessage = {
  penpal: MessageType.Ack;
  methodNames: string[];
};

/**
 * A mapped type to convert non async methods into async methods and exclude any non function properties.
 */
export type AsyncMethodReturns<T, K extends keyof T = FunctionPropertyNames<T>> = {
  [KK in K]: T[KK] extends (...args: any[]) => PromiseLike<any>
      ? T[KK]
      : T[KK] extends (...args: infer A) => infer R
          ? (...args: A) => Promise<R>
          : T[KK]
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
 * Methods that may be called that will invoke methods on the remote window.
 */
export type CallSender = {
  [index: string]: Function;
};

export type Connection<TCallSender extends object = CallSender> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<AsyncMethodReturns<TCallSender>>;
  /**
   * A method that, when called, will disconnect any messaging channels.
   * You may call this even before a connection has been established.
   */
  destroy: Function;
};

/**
 * A mapped type to extract only object properties which are functions.
 */
export type FunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];

/**
 * Methods to expose to the remote window.
 */
export type Methods = {
  [index: string]: Function;
};

/**
 * A Penpal-specific error.
 */
export type PenpalError = Error & { code: ErrorCode };

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
 * A SYN-ACK handshake message.
 */
export type SynAckMessage = {
  penpal: MessageType.SynAck;
  methodNames: string[];
};

/**
 * A SYN handshake message.
 */
export type SynMessage = {
  penpal: MessageType.Syn;
};

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
