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

// Penpal uses this default when someone calls connect({ messenger }). The
// Record<string, never> part gives RemoteProxy a key for any string, so names
// like add and multiply can become methods that return Promise<unknown>.
//
// A shared type or helper could supply Record<string, never> to describe an
// empty dictionary. Using that same type as the default would turn every
// name in that dictionary into a callable method. A string index also leaves
// symbol keys unchecked, so a type with only symbol keys could match it.
//
// The extra () => never signature gives the default a distinct shape.
// RemoteProxy copies property keys, so the signature stays on this input type.
//
// The signature uses a plain function type that TypeScript can write into
// a library's generated .d.ts file when it exports an inferred connection.
export type UnspecifiedRemoteMethods = Record<string, never> & (() => never);

type InspectionHook = 'then' | 'toJSON';
type NativeFunctionHelper = 'apply' | 'call' | 'bind';

// Without a methods type, TypeScript lets each name act as a method or a
// group. For example, both remote.files() and remote.files.save() return
// Promise<unknown> because the app did not declare their result types.
// The JavaScript proxy is a function at each member, so use native function
// types for its helpers. For example, remote.save.bind(null) returns a function.
type UntypedRemoteMember = {
  (...args: unknown[]): Promise<unknown>;
  [name: string]: UntypedRemoteMember;
} & Pick<Function, NativeFunctionHelper>;

// Penpal reads CallOptions only from the last argument. If A['length'] can
// be any number, the method has an open-ended rest parameter. Accept the
// original arguments or the original arguments followed by CallOptions.
// These two lists prevent a call like sum(1, options, 2) when sum takes
// only numbers. A single list with an optional slot would allow that call.
// When the method has a fixed maximum number of arguments, append an optional
// parameter so the IDE displays names such as a and b in multiply(a, b).
type RemoteMethod<A extends unknown[], R> = number extends A['length']
  ? (...args: A | [...A, options: CallOptions]) => R
  : (...args: [...A, options?: CallOptions]) => R;

// The proxy turns a declared method into a function that returns a promise.
// If the method returns a Reply, directly or in a promise, the caller's
// promise resolves to the value inside the Reply. For a group such as
// remote.files, apply the proxy rules to each method in the group.
type RemoteMember<T> = T extends (...args: infer A) => infer R
  ? RemoteMethod<A, Promise<ExtractValueFromReply<Awaited<R>>>>
  : T extends MethodsShape<T>
    ? RemoteProxyAtDepth<T, true>
    : never;

// The JavaScript proxy returns undefined for then and toJSON. That prevents
// await and JSON.stringify() from accidentally calling a remote method.
// TypeScript marks those names as undefined if the app declares them. For a
// dictionary with arbitrary string keys, leave them out of IDE suggestions.
//
// The root can expose a remote method named call, apply, or bind. A nested
// member uses the native function helpers for those names, so use never to
// stop TypeScript from treating them as remote methods. A dictionary such as
// Record<string, () => void> has one broad key type, string. The & below
// blocks those three names explicitly for nested dictionaries.
type RemoteProxyAtDepth<
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods,
  Nested extends boolean,
> = {
  // Keep the declared keys so a generic helper can read proxy[key] when key
  // is known to be a key of the remote methods type.
  [K in keyof TRemoteMethods]: K extends InspectionHook
    ? undefined
    : K extends (Nested extends true ? NativeFunctionHelper : never)
      ? never
      : TRemoteMethods extends UnspecifiedRemoteMethods
        ? UntypedRemoteMember
        : RemoteMember<TRemoteMethods[K]>;
} & (Nested extends true
  ? string extends keyof TRemoteMethods
    ? Partial<Record<NativeFunctionHelper, never>>
    : unknown
  : unknown);

/** The proxy for the declared remote methods, or an untyped proxy if no type is supplied. */
export type RemoteProxy<
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
> = RemoteProxyAtDepth<TRemoteMethods, false>;

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
