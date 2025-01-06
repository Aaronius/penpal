import { ErrorCode, MessageType } from './enums';
import Messenger from './Messenger';
import MethodCallOptions from './MethodCallOptions';
import Reply from './Reply';
import namespace from './namespace';

type ExtractReturnValueFromReply<R> = R extends Reply
  ? Awaited<R['returnValue']>
  : R;

/**
 * A mapped type to recursively convert sync methods into async methods and add
 * an optional MethodCallOptions argument.
 */
export type Remote<TMethods extends Methods = Methods> = {
  [K in keyof TMethods]: TMethods[K] extends (...args: infer A) => infer R
    ? (
        ...args: [...A, MethodCallOptions?]
      ) => Promise<ExtractReturnValueFromReply<Awaited<R>>>
    : TMethods[K] extends Methods
    ? Remote<TMethods[K]>
    : never;
};

/**
 * Connection object returned from calling connectToChild or connectToParent.
 */
export type Connection<TMethods extends Methods = Methods> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<Remote<TMethods>>;
  /**
   * A method that, when called, will disconnect any messaging channels.
   * You may call this even before a connection has been established.
   */
  destroy: () => void;
};

/**
 * Methods to expose to the remote window. May contain nested objects
 * with methods as well.
 */
export type Methods = {
  [index: string]: Methods | Function;
};

/**
 * A map of key path to function. The flatted counterpart of Methods.
 *
 * @example
 * If a Methods object were like this:
 * { one: { two: () => {} } }
 *
 * it would flatten to this:
 * { "one.two": () => {} }
 */
export type FlattenedMethods = Record<string, Function>;

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
  namespace: typeof namespace;
  type: MessageType.Syn;
};

/**
 * A SYN-ACK handshake message.
 */
export type SynAckMessage = {
  namespace: typeof namespace;
  type: MessageType.SynAck;
  methodPaths: string[];
};

/**
 * An ACK handshake message.
 */
export type AckMessage = {
  namespace: typeof namespace;
  type: MessageType.Ack;
  methodPaths: string[];
};

/**
 * A method call message.
 */
export type CallMessage = {
  namespace: typeof namespace;
  type: MessageType.Call;
  roundTripId: number;
  methodPath: string;
  args: unknown[];
};

/**
 * A method response message.
 */
export type ReplyMessage = {
  namespace: typeof namespace;
  type: MessageType.Reply;
  roundTripId: number;
} & (
  | {
      isError?: false;
      returnValue: unknown;
      error?: never;
      isSerializedErrorInstance?: never;
    }
  | {
      isError: true;
      returnValue?: never;
      // Note that error may be undefined, for example, if the consumer
      // returns a rejected promise without specifying an error.
      // (e.g., return Promise.reject())
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
