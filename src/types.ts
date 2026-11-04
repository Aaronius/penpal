import type CallOptions from './CallOptions.js';
import type Reply from './Reply.js';
import namespace from './namespace.js';
import ErrorCodeObj from './ErrorCodeObj.js';

type ExtractValueFromReply<R> = R extends Reply ? Awaited<R['value']> : R;

/**
 * Checks the properties declared in a methods type. Each must be a callable
 * method or a nested group of methods. Method paths use string keys; numeric
 * property names are also allowed because JavaScript treats them as strings.
 */
export type MethodsShape<T> = object & {
  [K in keyof T]-?: K extends string | number
    ? ((...args: never[]) => unknown) | MethodsShape<T[K]>
    : never;
};

// Distinguishes an omitted remote methods type from an explicitly empty one.
export type UnspecifiedRemoteMethods = undefined;

// Without a remote methods type, each member can be called or used to reach
// another member. The result is unknown because no return type was supplied.
type UntypedRemoteMember = {
  (...args: unknown[]): Promise<unknown>;
  [name: string]: UntypedRemoteMember;
};

// With no declared remote methods, allow any string as a top-level method name
// or group name.
type UntypedRemoteProxy = Record<string, UntypedRemoteMember>;

// Preserve the method's arguments and allow trailing call options. Await the
// result before unwrapping Reply so both Reply and Promise<Reply> work.
type RemoteMember<T> = T extends (...args: infer A) => infer R
  ? (
      ...args: [...A, CallOptions?]
    ) => Promise<ExtractValueFromReply<Awaited<R>>>
  : TypedRemoteProxy<T>;

// Preserve the declared keys and map each one to an async method or a nested
// proxy, depending on what the remote methods type declares for that key.
type TypedRemoteProxy<T> = {
  [K in keyof T]: RemoteMember<T[K]>;
};

/** The proxy for the declared remote methods, or an untyped proxy if no type is supplied. */
export type RemoteProxy<
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
> = TRemoteMethods extends UnspecifiedRemoteMethods
  ? UntypedRemoteProxy
  : TypedRemoteProxy<TRemoteMethods>;

/** The connection returned by connect(). */
export type Connection<
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
> = {
  /** Resolves with the remote proxy once the connection is established. */
  promise: Promise<RemoteProxy<TRemoteMethods>>;
  /** Disconnects communication, even before the connection is established. */
  destroy: () => void;
};

/** A path to a method, kept as segments because names can contain periods. */
export type MethodPath = string[];

export type ErrorCode = (typeof ErrorCodeObj)[keyof typeof ErrorCodeObj];

export type SerializedError = {
  name: string;
  message: string;
  stack?: string | undefined;
  penpalCode?: ErrorCode | undefined;
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
