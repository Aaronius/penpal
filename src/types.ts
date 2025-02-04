import { ErrorCode, MessageType } from './enums';
import MethodCallOptions from './MethodCallOptions';
import Reply from './Reply';
import namespace from './namespace';

type ExtractValueFromReply<R> = R extends Reply ? Awaited<R['value']> : R;

/**
 * An object representing methods exposed by the remote but that can be called
 * locally.
 */
export type RemoteProxy<TMethods extends Methods = Methods> = {
  [K in keyof TMethods]: TMethods[K] extends (...args: infer A) => infer R
    ? (
        ...args: [...A, MethodCallOptions?]
      ) => Promise<ExtractValueFromReply<Awaited<R>>>
    : TMethods[K] extends Methods
    ? RemoteProxy<TMethods[K]>
    : never;
};

/**
 * Connection object returned from calling connectToChild or connectToParent.
 */
export type Connection<TMethods extends Methods = Methods> = {
  /**
   * A promise which will be resolved once a connection has been established.
   */
  promise: Promise<RemoteProxy<TMethods>>;
  /**
   * A method that, when called, will disconnect any communication.
   * You may call this even before a connection has been established.
   */
  close: () => void;
};

/**
 * Methods to expose to the remote window. May contain nested objects
 * with methods as well.
 */
export type Methods = {
  [index: string]: Methods | Function;
};

/**
 * An array of path segments (object property keys) to use to find a method
 * within a Methods object. We avoid using a period-delimited string because
 * property names can have periods in them which could cause issues.
 */
export type MethodPath = string[];

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  penpalCode?: ErrorCode;
};

export type SynMessage = {
  type: MessageType.Syn;
};

export type SynAckMessage = {
  type: MessageType.SynAck;
  // TODO: Used for backward-compatibility. Remove in next major version.
  methodPaths: MethodPath[];
};

export type AckMessage = {
  type: MessageType.Ack;
};

export type CallMessage = {
  type: MessageType.Call;
  id: string;
  methodPath: MethodPath;
  args: unknown[];
};

export type ReplyMessage = {
  type: MessageType.Reply;
  callId: string;
} & (
  | {
      value: unknown;
      isError?: false;
    }
  | {
      value: SerializedError;
      isError: true;
    }
);

export type Message =
  | SynMessage
  | SynAckMessage
  | AckMessage
  | CallMessage
  | ReplyMessage;

export type Envelope<TMessage extends Message = Message> = {
  namespace: typeof namespace;
  channel?: string;
  message: TMessage;
};

export type Log = (...args: unknown[]) => void;
