import CallOptions from './CallOptions.js';
import Reply from './Reply.js';
import namespace from './namespace.js';
import ErrorCodeObj from './ErrorCodeObj.js';

type ExtractValueFromReply<R> = R extends Reply ? Awaited<R['value']> : R;

/**
 * An object representing methods exposed by the remote but that can be called
 * locally.
 */
export type RemoteProxy<TMethods extends Methods = Methods> = {
  [K in keyof TMethods]: TMethods[K] extends (...args: infer A) => infer R
    ? (
        ...args: [...A, CallOptions?]
      ) => Promise<ExtractValueFromReply<Awaited<R>>>
    : TMethods[K] extends Methods
    ? RemoteProxy<TMethods[K]>
    : never;
};

/**
 * An object representing the connection as a result of calling connect().
 */
export type Connection<TMethods extends Methods = Methods> = {
  /**
   * A promise which will be resolved once the connection has been established.
   */
  promise: Promise<RemoteProxy<TMethods>>;
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
 * An array of path segments (object property keys) to use to find a method
 * within a Methods object. We avoid using a period-delimited string because
 * property names can have periods in them which could cause issues.
 */
export type MethodPath = string[];

export type ErrorCode = typeof ErrorCodeObj[keyof typeof ErrorCodeObj];

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  penpalCode?: ErrorCode;
};

type MessageBase = {
  namespace: typeof namespace;
  // Purposely specifying undefined as a type rather than making this an
  // optional property so we don't forget to set it anywhere.
  channel: string | undefined;
};

export type SynMessage = MessageBase & {
  type: 'SYN';
  participantId: string;
};

export type Ack1Message = MessageBase & {
  type: 'ACK1';
  // TODO: Used for backward-compatibility. Remove in next major version.
  methodPaths: MethodPath[];
};

export type Ack2Message = MessageBase & {
  type: 'ACK2';
};

export type CallMessage = MessageBase & {
  type: 'CALL';
  id: string;
  methodPath: MethodPath;
  args: unknown[];
};

export type ReplyMessage = MessageBase & {
  type: 'REPLY';
  callId: string;
} & (
    | {
        value: unknown;
        isError?: false;
        isSerializedErrorInstance?: false;
      }
    | {
        value: unknown;
        isError: true;
        isSerializedErrorInstance?: false;
      }
    | {
        value: SerializedError;
        isError: true;
        isSerializedErrorInstance: true;
      }
  );

export type DestroyMessage = MessageBase & {
  type: 'DESTROY';
};

export type Message =
  | SynMessage
  | Ack1Message
  | Ack2Message
  | CallMessage
  | ReplyMessage
  | DestroyMessage;

export type Log = (...args: unknown[]) => void;
