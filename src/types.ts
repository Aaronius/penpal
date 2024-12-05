import { ErrorCode, MessageType, Resolution } from './enums';
import Messenger from './Messenger';

/**
 * Extract keys of T whose values are assignable to U.
 */
type ExtractKeys<T, U> = {
  [P in keyof T]: T[P] extends U ? P : never;
}[keyof T];

/**
 * A mapped type to recursively convert non async methods into async methods and exclude
 * any non function properties from T.
 */
export type AsyncMethodReturns<T> = {
  [K in ExtractKeys<T, Function | object>]: T[K] extends (
    ...args: unknown[]
  ) => PromiseLike<any>
    ? T[K]
    : T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : AsyncMethodReturns<T[K]>;
};

/**
 * Methods that may be called that will invoke methods on the remote window.
 */
export type CallSender = {
  [index: string]: Function;
};

/**
 * Connection object returned from calling connectToChild or connectToParent.
 */
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
 * Methods to expose to the remote window.
 */
export type Methods = {
  [index: string]: Methods | Function;
};

/**
 * A map of key path to function. The flatted counterpart of Methods.
 */
export type SerializedMethods = {
  [index: string]: Function;
};

export type SerializedError = {
  name: string;
  message: string;
  stack: string | undefined;
};

/**
 * A Penpal-specific error.
 */
export type PenpalError = Error & { code: ErrorCode };

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
 * A method call message.
 */
export type CallMessage = {
  penpal: MessageType.Call;
  id: number;
  methodName: string;
  args: unknown[];
};

/**
 * A method response message.
 */
export type ReplyMessage = {
  penpal: MessageType.Reply;
  id: number;
  resolution: Resolution;
  returnValue: unknown;
  returnValueIsError?: boolean;
};

export type PenpalMessage =
  | SynMessage
  | SynAckMessage
  | AckMessage
  | CallMessage
  | ReplyMessage;

export type WindowsInfo = {
  /**
   * A friendly name for the local window.
   */
  localName: 'Parent' | 'Child';

  messenger: Messenger;
};
