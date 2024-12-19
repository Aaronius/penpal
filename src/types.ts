import { ErrorCode, MessageType } from './enums';
import Messenger from './Messenger';
import MethodCallOptions from './MethodCallOptions';
import Reply from './Reply';

type ExtractReturnValueFromReply<R> = R extends Reply
  ? Awaited<R['returnValue']>
  : R;

/**
 * A mapped type to recursively convert sync methods into async methods and add
 * an optional MethodCallOptions argument.
 */
export type Remote<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (
        ...args: [...A, MethodCallOptions?]
      ) => Promise<ExtractReturnValueFromReply<Awaited<R>>>
    : T[K] extends object
    ? Remote<T[K]>
    : never;
};

/**
 * Methods that may be called that will invoke methods on the remote window.
 */
export type CallSender = Record<string, (...args: unknown[]) => unknown>;

/**
 * Connection object returned from calling connectToChild or connectToParent.
 */
export type Connection<TCallSender extends object = CallSender> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<Remote<TCallSender>>;
  /**
   * A method that, when called, will disconnect any messaging channels.
   * You may call this even before a connection has been established.
   */
  destroy: () => void;
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
export type SerializedMethods = Record<string, Function>;

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
} & (
  | {
      returnValue: unknown;
      isError?: false;
      error?: never;
      isSerializedErrorInstance?: never;
    }
  | {
      returnValue?: never;
      isError: true;
      error: unknown;
      isSerializedErrorInstance: boolean;
    }
);

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

export type Log = (...args: unknown[]) => void;

export type DestructorCallback = (error?: PenpalError) => void;

export type Destructor = {
  /**
   * Calls all onDestroy callbacks.
   */
  destroy(error?: PenpalError): void;
  /**
   * Registers a callback to be called when destroy is called.
   */
  onDestroy(callback: DestructorCallback): void;
};
