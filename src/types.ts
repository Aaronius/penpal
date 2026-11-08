import type CallOptions from './CallOptions.js';
import type Reply from './Reply.js';
import type namespace from './namespace.js';
import type ErrorCodeObj from './ErrorCodeObj.js';

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

// When the caller omits the methods type, the string index gives the proxy a
// key for any method name. The call signature distinguishes this default from
// an explicit Record<string, never>, which has no callable methods.
//
// RemoteProxy maps property keys, so the call signature stays on this input
// type. TypeScript can also spell out this structural type in the .d.ts file
// of a consumer that exports an inferred connection or proxy.
export type UnspecifiedRemoteMethods = Record<string, never> & (() => never);

// Without a remote methods type, each member can be called or used to reach
// another member. The result is unknown because no return type was supplied.
type UntypedRemoteMember = {
  (...args: unknown[]): Promise<unknown>;
  [name: string]: UntypedRemoteMember;
};

// Keep the method's argument types and allow a trailing CallOptions argument.
// Await the result first so both Reply and Promise<Reply> can be unwrapped.
// For a nested group, check its shape before reusing RemoteProxy so its hover
// shows the same public type name as the top-level proxy.
type RemoteMember<T> = T extends (...args: infer A) => infer R
  ? (
      ...args: [...A, CallOptions?]
    ) => Promise<ExtractValueFromReply<Awaited<R>>>
  : T extends MethodsShape<T>
    ? RemoteProxy<T>
    : never;

/** The proxy for the declared remote methods, or an untyped proxy if no type is supplied. */
export type RemoteProxy<
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
> = {
  // Map the original keys directly so a generic helper can use proxy[key]
  // when key is known to belong to TRemoteMethods. Choose the typed or untyped
  // member inside the map so the result keeps the RemoteProxy name in hovers.
  [K in keyof TRemoteMethods]: TRemoteMethods extends UnspecifiedRemoteMethods
    ? UntypedRemoteMember
    : RemoteMember<TRemoteMethods[K]>;
};

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

/**
 * The message event properties Penpal reads from workers and message ports.
 * Describing them here avoids requiring the browser's MessageEvent type in
 * Node-only projects. The payload stays unknown until the messenger validates it.
 */
export type MessageEventLike = Event & {
  readonly data: unknown;
  readonly ports: readonly MessagePortLike[];
};

// Browser workers and both browser and Node MessagePorts use EventTarget APIs.
// Match their accepted listener forms (a callback, a handleEvent() object, or
// null) so their native declarations are compatible with this shared interface.
// Penpal itself only registers callbacks. Node workers use a separate
// EventEmitter API, which NodeWorkerMessenger handles directly.
type MessageListener =
  | ((event: MessageEventLike) => void)
  | { handleEvent(event: MessageEventLike): void }
  | null;

/** The message listener operations shared by browser workers and browser/Node ports. */
export type MessageEventTarget = {
  addEventListener(type: 'message', listener: MessageListener): void;
  removeEventListener(type: 'message', listener: MessageListener): void;
};

/**
 * The port operations Penpal needs. Both browser and Node MessagePorts match
 * this shape, so consumers only need declarations for their own environment.
 */
export type MessagePortLike = MessageEventTarget & {
  postMessage(
    value: unknown,
    transferList?: readonly PenpalTransferable[],
  ): void;
  start(): void;
  close(): void;
};

// Extract the type of one transferable item from an API parameter. Native APIs
// accept either a transfer list directly, such as [port], or an options object,
// such as { transfer: [port] }, so handle both forms.
type TransferableFromArgument<Argument> =
  Argument extends readonly (infer Item)[]
    ? Item
    : Argument extends { transfer?: readonly (infer Item)[] }
      ? Item
      : never;

/**
 * The full native port type, obtained from the global MessagePort constructor.
 * It resolves to the browser port when browser declarations are present, and
 * the Node port in Node-only projects. Its postMessage() parameters let us
 * infer the platform's transferable types below.
 */
type NativeMessagePort = InstanceType<typeof MessagePort>;

/**
 * Transferable values described by the consumer's browser and/or Node types.
 * Infer them from native APIs instead of importing Node types or requiring the
 * browser's global Transferable type, so each environment can compile on its own.
 *
 * When a project loads both browser libraries and Node typings, structuredClone()
 * has signatures from both environments. Parameters<typeof structuredClone>
 * extracts parameters from only the last overload, which can be Node's version.
 * Its transfer list leaves out browser-only types such as ImageBitmap.
 *
 * The global MessagePort uses the browser's declaration in these projects.
 * Its postMessage() parameters supply the missing browser transfer types.
 * Combine both sources so this type includes Node and browser transferables.
 */
export type PenpalTransferable = TransferableFromArgument<
  | Parameters<typeof structuredClone>[1]
  | Parameters<NativeMessagePort['postMessage']>[1]
>;
