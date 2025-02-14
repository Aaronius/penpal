import generateId from './generateId';
import { deserializeError } from './errorSerialization';
import { formatMethodPath } from './methodSerialization';
import {
  Message,
  RemoteProxy,
  Methods,
  MethodPath,
  CallMessage,
  Log,
} from './types';
import { ErrorCode, MessageType } from './enums';
import CallOptions from './CallOptions';
import Messenger from './messengers/Messenger';
import PenpalError from './PenpalError';
import { isFunction, isReplyMessage } from './guards';
import namespace from './namespace';

type ReplyHandler = {
  methodPath: MethodPath;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId?: number;
};

const createRemoteProxy = (
  callback: (path: MethodPath, args: unknown[]) => void,
  log?: Log,
  path: MethodPath = []
): Methods => {
  return new Proxy(
    path
      ? () => {
          // Intentionally empty
        }
      : Object.create(null),
    {
      get(_target, prop: string) {
        // If a promise is resolved with this proxy object, the JavaScript
        // runtime will look for a `then` property on this object to determine
        // if it should be treated as a promise (to support promise chaining).
        // If we don't return undefined here, the JavaScript runtime will treat
        // this object as a promise and attempt to call `then`, which will
        // then send a call message to the remote. This is not what we want.
        if (prop === 'then') {
          return;
        }
        return createRemoteProxy(callback, log, [...path, prop]);
      },
      apply(target, _thisArg, args) {
        if (log) {
          const lastPathSegment = path.at(-1);
          const builtInFunction = (target as Record<string, unknown>)[
            lastPathSegment!
          ];
          if (isFunction(builtInFunction)) {
            log(
              `You may be attempting to call the native ` +
                `\`${lastPathSegment}\` method which is not supported. Call ` +
                `will be sent to remote.`
            );
          }
        }

        return callback(path, args);
      },
    }
  );
};

const getDestroyedConnectionMethodCallError = (methodPath: MethodPath) => {
  return new PenpalError(
    ErrorCode.ConnectionDestroyed,
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
      const timeoutId = timeout
        ? window.setTimeout(() => {
            replyHandlers.delete(callId);
            reject(
              new PenpalError(
                ErrorCode.MethodCallTimeout,
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
          type: MessageType.Call,
          id: callId,
          methodPath,
          args: argsWithoutOptions,
        };
        log?.(`Sending ${formatMethodPath(methodPath)}() call`, callMessage);
        messenger.sendMessage(callMessage, transferables);
      } catch (error) {
        reject(
          new PenpalError(
            ErrorCode.TransmissionFailed,
            (error as Error).message
          )
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
