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
import MethodCallOptions from './MethodCallOptions';
import Messenger from './messengers/Messenger';
import PenpalError from './PenpalError';
import { isReplyMessage } from './guards';
import namespace from './namespace';

type ReplyHandler = {
  methodPath: MethodPath;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId?: number;
};

const createRemoteProxy = (
  callback: (path: MethodPath, args: unknown[]) => void,
  path: MethodPath = []
) => {
  return new Proxy(
    path
      ? () => {
          // Intentionally empty
        }
      : {},
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
        return createRemoteProxy(callback, [...path, prop]);
      },
      apply(_target, _thisArg, args) {
        return callback(path, args);
      },
    }
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
  let isClosed = false;
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
    if (isClosed) {
      throw new PenpalError(
        ErrorCode.ConnectionClosed,
        `Unable to send ${formatMethodPath(methodPath)}() call due ` +
          `to closed connection`
      );
    }

    const callId = generateId();
    const lastArg = args[args.length - 1];
    const lastArgIsOptions = lastArg instanceof MethodCallOptions;
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
  }) as RemoteProxy<TMethods>;

  const close = () => {
    isClosed = true;
    messenger.removeMessageHandler(handleMessage);

    for (const { methodPath, reject, timeoutId } of replyHandlers.values()) {
      clearTimeout(timeoutId);
      reject(
        new PenpalError(
          ErrorCode.ConnectionClosed,
          `Method call ${formatMethodPath(
            methodPath
          )}() cannot be resolved due to closed connection`
        )
      );
    }

    replyHandlers.clear();
  };

  return {
    remoteProxy,
    close,
  };
};

export default connectRemoteProxy;
