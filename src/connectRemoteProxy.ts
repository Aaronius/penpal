import generateId from './generateId.js';
import { deserializeError } from './errorSerialization.js';
import { formatMethodPath } from './methodSerialization.js';
import {
  Message,
  RemoteProxy,
  Methods,
  MethodPath,
  CallMessage,
  Log,
} from './types.js';
import CallOptions from './CallOptions.js';
import Messenger from './messengers/Messenger.js';
import PenpalError from './PenpalError.js';
import { isReplyMessage } from './guards.js';
import namespace from './namespace.js';

type ReplyHandler = {
  methodPath: MethodPath;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId?: number;
};

const methodsToTreatAsNative = new Set(['apply', 'call', 'bind']);

const createRemoteProxy = (
  callback: (path: MethodPath, args: unknown[]) => void,
  log?: Log,
  path: MethodPath = []
): Methods => {
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
    }
  );
};

const getDestroyedConnectionMethodCallError = (methodPath: MethodPath) => {
  return new PenpalError(
    'CONNECTION_DESTROYED',
    `Method call ${formatMethodPath(
      methodPath
    )}() failed due to destroyed connection`
  );
};

/**
 * Creates a proxy. When methods are called on the proxy, a "call" message will
 * be sent to the remote, the remote's corresponding method will be
 * executed, and the method's return value will be returned via a message.
 */
const connectRemoteProxy = <TMethods extends Methods>(
  messenger: Messenger,
  channel: string | undefined,
  log: Log | undefined
) => {
  let isDestroyed = false;
  const replyHandlers = new Map<string, ReplyHandler>();

  const handleMessage = (message: Message) => {
    if (!isReplyMessage(message)) {
      return;
    }

    const { callId, value, isError, isSerializedErrorInstance } = message;
    const replyHandler = replyHandlers.get(callId);

    if (!replyHandler) {
      return;
    }

    replyHandlers.delete(callId);
    log?.(
      `Received ${formatMethodPath(replyHandler.methodPath)}() call`,
      message
    );

    if (isError) {
      replyHandler.reject(
        isSerializedErrorInstance ? deserializeError(value) : value
      );
    } else {
      replyHandler.resolve(value);
    }
  };

  messenger.addMessageHandler(handleMessage);

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
      // We reference `window.setTimeout` instead of just `setTimeout`
      // so that the TypeScript engine doesn't
      // get confused when running tests. Something within
      // Karma + @rollup/plugin-typescript leaks node types into source
      // files when running tests. Node's setTimeout has a return type of
      // Timeout rather than number, resulting in a build error when
      // running tests if we don't disambiguate the browser setTimeout
      // from node's setTimeout. There may be a better way to configure
      // Karma + Rollup + Typescript to avoid node type leakage.
      const timeoutId =
        timeout !== undefined
          ? window.setTimeout(() => {
              replyHandlers.delete(callId);
              reject(
                new PenpalError(
                  'METHOD_CALL_TIMEOUT',
                  `Method call ${formatMethodPath(
                    methodPath
                  )}() timed out after ${timeout}ms`
                )
              );
            }, timeout)
          : undefined;

      replyHandlers.set(callId, { methodPath, resolve, reject, timeoutId });

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
        reject(
          new PenpalError('TRANSMISSION_FAILED', (error as Error).message)
        );
      }
    });
  }, log) as RemoteProxy<TMethods>;

  const destroy = () => {
    isDestroyed = true;
    messenger.removeMessageHandler(handleMessage);

    for (const { methodPath, reject, timeoutId } of replyHandlers.values()) {
      clearTimeout(timeoutId);
      reject(getDestroyedConnectionMethodCallError(methodPath));
    }

    replyHandlers.clear();
  };

  return {
    remoteProxy,
    destroy,
  };
};

export default connectRemoteProxy;
