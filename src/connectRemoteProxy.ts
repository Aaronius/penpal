import generateId from './generateId.js';
import { deserializeError } from './errorSerialization.js';
import { formatMethodPath } from './methodPath.js';
import type {
  RemoteProxy,
  MethodsShape,
  UnspecifiedRemoteMethods,
  MethodPath,
  CallMessage,
  ReplyMessage,
  Log,
} from './types.js';
import CallOptions from './CallOptions.js';
import type Messenger from './messengers/Messenger.js';
import PenpalError from './PenpalError.js';
import namespace from './namespace.js';
import scheduleTimeout from './scheduleTimeout.js';

type ReplyHandler = {
  methodPath: MethodPath;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  cancelTimeout: (() => void) | undefined;
};

export type RemoteProxyController<
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods,
> = {
  remoteProxy: RemoteProxy<TRemoteMethods>;
  handleMessage: (message: ReplyMessage) => void;
  rejectCallsOnReconnect: () => void;
  destroy: () => void;
};

const methodsToTreatAsNative = new Set(['apply', 'call', 'bind']);

const createRemoteProxy = (
  callback: (path: MethodPath, args: unknown[]) => Promise<unknown>,
  log: Log | undefined,
  path: MethodPath = [],
): object => {
  return new Proxy(
    path.length
      ? () => {
          // Intentionally empty
        }
      : Object.create(null),
    {
      get(target, prop: string) {
        // If a promise is resolved with this proxy object, the JavaScript
        // runtime will look for a `then` property on this object to determine
        // if it should be treated as a promise (to support promise chaining).
        // If we don't return undefined here, the JavaScript runtime will treat
        // this object as a promise and attempt to call `then`, which will
        // then send a call message to the remote. This is not what we want.
        if (prop === 'then') {
          return;
        }

        // Because we're using a proxy and because Penpal supports developers
        // exposing nested methods, we have a predicament. If a developer
        // calls, for example, remote.auth.apply(), are they
        // attempting to call a nested apply() method that a developer has
        // explicitly exposed from the remote? Could they instead be attempting
        // to call Function.prototype.apply() on the remote.auth() method?
        // Without the remote telling the local Penpal which methods the
        // developer has exposed, it has no way of knowing (and the main reason
        // we use a proxy is so that Penpal doesn't have to communicate which
        // methods are exposed). So, we treat certain methods as native methods
        // and return the native method rather than a proxy. The downside of
        // this is that if a developer has explicitly exposed a nested method
        // with the same name as one of these native method names, the developer
        // will be unable to call the exposed remote method because they will
        // be calling the method on the Function prototype instead.
        if (path.length && methodsToTreatAsNative.has(prop)) {
          return Reflect.get(target, prop);
        }

        return createRemoteProxy(callback, log, [...path, prop]);
      },
      apply(target, _thisArg, args) {
        return callback(path, args);
      },
    },
  );
};

const getDestroyedConnectionMethodCallError = (methodPath: MethodPath) => {
  return new PenpalError(
    'CONNECTION_DESTROYED',
    `Method call ${formatMethodPath(
      methodPath,
    )}() failed due to destroyed connection`,
  );
};

/**
 * Creates the proxy the app uses to call remote methods. Each call sends a
 * message and returns a promise. A matching reply resolves or rejects it.
 * The controller can reject pending calls when the remote reconnects while
 * keeping the same proxy available for future calls.
 */
const connectRemoteProxy = <
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods,
>(
  messenger: Messenger,
  channel: string | undefined,
  log: Log | undefined,
): RemoteProxyController<TRemoteMethods> => {
  let isDestroyed = false;
  const replyHandlers = new Map<string, ReplyHandler>();

  const handleMessage = (message: ReplyMessage) => {
    const { callId, value, isError, isSerializedErrorInstance } = message;
    const replyHandler = replyHandlers.get(callId);

    if (!replyHandler) {
      return;
    }

    replyHandlers.delete(callId);
    replyHandler.cancelTimeout?.();
    log?.(
      `Received ${formatMethodPath(replyHandler.methodPath)}() reply`,
      message,
    );

    if (isError) {
      replyHandler.reject(
        isSerializedErrorInstance ? deserializeError(value) : value,
      );
    } else {
      replyHandler.resolve(value);
    }
  };

  const remoteProxy = createRemoteProxy((methodPath, args) => {
    if (isDestroyed) {
      throw getDestroyedConnectionMethodCallError(methodPath);
    }

    const callId = generateId();
    const lastArg = args[args.length - 1];
    const lastArgIsOptions = lastArg instanceof CallOptions;
    const { timeout, transferables } = lastArgIsOptions ? lastArg : {};
    const argsWithoutOptions = lastArgIsOptions ? args.slice(0, -1) : args;

    return new Promise((resolve, reject) => {
      const cancelTimeout = scheduleTimeout(() => {
        replyHandlers.delete(callId);
        reject(
          new PenpalError(
            'METHOD_CALL_TIMEOUT',
            `Method call ${formatMethodPath(
              methodPath,
            )}() timed out after ${timeout}ms`,
          ),
        );
      }, timeout);

      replyHandlers.set(callId, { methodPath, resolve, reject, cancelTimeout });

      try {
        const callMessage: CallMessage = {
          namespace,
          channel,
          type: 'CALL',
          id: callId,
          methodPath,
          args: argsWithoutOptions,
        };
        log?.(`Sending ${formatMethodPath(methodPath)}() call`, callMessage);
        messenger.sendMessage(callMessage, transferables);
      } catch (error) {
        replyHandlers.delete(callId);
        cancelTimeout?.();
        reject(
          new PenpalError('TRANSMISSION_FAILED', (error as Error).message),
        );
      }
    });
  }, log) as RemoteProxy<TRemoteMethods>;

  const rejectPendingCalls = (getError: (path: MethodPath) => PenpalError) => {
    for (const {
      methodPath,
      reject,
      cancelTimeout,
    } of replyHandlers.values()) {
      cancelTimeout?.();
      reject(getError(methodPath));
    }

    replyHandlers.clear();
  };

  return {
    remoteProxy,
    handleMessage,
    rejectCallsOnReconnect: () => {
      rejectPendingCalls(
        (methodPath) =>
          new PenpalError(
            'TRANSMISSION_FAILED',
            `Method call ${formatMethodPath(methodPath)}() failed because the remote reconnected before replying`,
          ),
      );
    },
    destroy: () => {
      isDestroyed = true;
      rejectPendingCalls(getDestroyedConnectionMethodCallError);
    },
  };
};

export default connectRemoteProxy;
