import generateId from './generateId';
import { deserializeError } from './errorSerialization';
import { unflattenMethods } from './methodSerialization';
import { PenpalMessage, RemoteMethodProxies, Methods } from './types';
import { ErrorCode, MessageType } from './enums';
import MethodCallOptions from './MethodCallOptions';
import Messenger from './Messenger';
import PenpalError from './PenpalError';

type ReplyHandler = {
  methodPath: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId?: number;
};

/**
 * Augments an object with methods that match those defined by the remote. When these methods are
 * called, a "call" message will be sent to the remote, the remote's corresponding method will be
 * executed, and the method's return value will be returned via a message.
 */
export default <TMethods extends Methods>(
  messenger: Messenger,
  methodPaths: string[]
) => {
  let isClosed = false;

  const replyHandlers = new Map<number, ReplyHandler>();

  const handleMessage = (message: PenpalMessage) => {
    if (message.type !== MessageType.Reply) {
      return;
    }

    const replyHandler = replyHandlers.get(message.sessionId);

    if (!replyHandler) {
      return;
    }

    replyHandlers.delete(message.sessionId);

    if (message.isError) {
      const error = deserializeError(message.value);
      replyHandler.reject(error);
    } else {
      replyHandler.resolve(message.value);
    }
  };

  messenger.addMessageHandler(handleMessage);

  const createMethodProxy = (methodPath: string) => {
    return (...args: unknown[]) => {
      if (isClosed) {
        throw new PenpalError(
          ErrorCode.ConnectionClosed,
          `Unable to send ${methodPath}() call due ` + `to closed connection`
        );
      }

      const sessionId = generateId();
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
              replyHandlers.delete(sessionId);
              reject(
                new PenpalError(
                  ErrorCode.MethodCallTimeout,
                  `Method call ${methodPath}() timed out after ${timeout}ms`
                )
              );
            }, timeout)
          : undefined;

        replyHandlers.set(sessionId, {
          methodPath,
          resolve,
          reject,
          timeoutId,
        });

        try {
          messenger.sendMessage(
            {
              type: MessageType.Call,
              sessionId,
              methodPath,
              args: argsWithoutOptions,
            },
            transferables
          );
        } catch (error) {
          reject(
            new PenpalError(
              ErrorCode.TransmissionFailed,
              (error as Error).message
            )
          );
        }
      });
    };
  };

  // Wrap each method in a proxy which sends it to the corresponding receiver.
  const flattedMethodProxies = methodPaths.reduce<
    Record<string, () => Promise<unknown>>
  >((memo, methodPath) => {
    memo[methodPath] = createMethodProxy(methodPath);
    return memo;
  }, {});

  const remoteMethodProxies = unflattenMethods(
    flattedMethodProxies
  ) as RemoteMethodProxies<TMethods>;

  const close = () => {
    {
      isClosed = true;
      messenger.removeMessageHandler(handleMessage);

      for (const { methodPath, reject, timeoutId } of replyHandlers.values()) {
        clearTimeout(timeoutId);
        reject(
          new PenpalError(
            ErrorCode.ConnectionClosed,
            `Method call ${methodPath}() cannot be resolved due to closed connection`
          )
        );
      }

      replyHandlers.clear();
    }
  };

  return {
    remoteMethodProxies,
    close,
  };
};
