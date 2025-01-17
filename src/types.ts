import { MessageType } from './enums';
import MethodCallOptions from './MethodCallOptions';
import Reply from './Reply';
import namespace from './namespace';
import PenpalError from './PenpalError';

type ExtractValueFromReply<R> = R extends Reply ? Awaited<R['value']> : R;

/**
 * A mapped type to recursively convert sync methods into async methods and add
 * an optional MethodCallOptions argument.
 */
export type RemoteMethodProxies<TMethods extends Methods = Methods> = {
  [K in keyof TMethods]: TMethods[K] extends (...args: infer A) => infer R
    ? (
        ...args: [...A, MethodCallOptions?]
      ) => Promise<ExtractValueFromReply<Awaited<R>>>
    : TMethods[K] extends Methods
    ? RemoteMethodProxies<TMethods[K]>
    : never;
};

/**
 * Connection object returned from calling connectToChild or connectToParent.
 */
export type Connection<TMethods extends Methods = Methods> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<RemoteMethodProxies<TMethods>>;
  /**
   * A method that, when called, will disconnect any communication.
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
  stack?: string;
};

export type SynMessage = {
  type: MessageType.Syn;
};

export type SynAckMessage = {
  type: MessageType.SynAck;
  methodPaths: string[];
};

export type AckMessage = {
  type: MessageType.Ack;
  methodPaths: string[];
};

export type CallMessage = {
  type: MessageType.Call;
  roundTripId: number;
  methodPath: string;
  args: unknown[];
};

export type ReplyMessage = {
  type: MessageType.Reply;
  roundTripId: number;
} & (
  | {
      isError?: false;
      value: unknown;
      error?: never;
      isSerializedErrorInstance?: never;
    }
  | {
      isError: true;
      value?: never;
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

export type PenpalMessageEnvelope = {
  namespace: typeof namespace;
  channel?: string;
  message: PenpalMessage;
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
