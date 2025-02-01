import generateId from './generateId';
import { deserializeError } from './errorSerialization';
import { buildProxyMethodsFromMethodPaths } from './methodSerialization';
import {
  Message,
  RemoteMethodProxies,
  Methods,
  MethodPath,
  MethodProxy,
  CallMessage,
} from './types';
import { ErrorCode, MessageType } from './enums';
import MethodCallOptions from './MethodCallOptions';
import Messenger from './Messenger';
import PenpalError from './PenpalError';
import { isReplyMessage } from './guards';

type ReplyHandler = {
  methodPath: MethodPath;
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
  methodPaths: MethodPath[]
) => {
  let isClosed = false;

  const replyHandlers = new Map<number, ReplyHandler>();

  const handleMessage = (message: Message) => {
    if (!isReplyMessage(message)) {
      return;
    }

    const { callId, value, isError } = message;

    const replyHandler = replyHandlers.get(callId);

    if (!replyHandler) {
      return;
    }

    replyHandlers.delete(callId);

    if (isError) {
      const error = deserializeError(value);
      replyHandler.reject(error);
    } else {
      replyHandler.resolve(value);
    }
  };

  messenger.addMessageHandler(handleMessage);

  const createMethodProxy = (methodPath: MethodPath): MethodProxy => {
    return (...args: unknown[]) => {
      if (isClosed) {
        throw new PenpalError(
          ErrorCode.ConnectionClosed,
          `Unable to send ${methodPath.join('.')}() call due ` +
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
                  `Method call ${methodPath.join(
                    '.'
                  )}() timed out after ${timeout}ms`
                )
              );
            }, timeout)
          : undefined;

        replyHandlers.set(callId, {
          methodPath,
          resolve,
          reject,
          timeoutId,
        });

        try {
          const callMessage: CallMessage = {
            type: MessageType.Call,
            id: callId,
            methodPath,
            args: argsWithoutOptions,
          };
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
    };
  };

  const remoteMethodProxies = buildProxyMethodsFromMethodPaths(
    methodPaths,
    createMethodProxy
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
            `Method call ${methodPath.join(
              '.'
            )}() cannot be resolved due to closed connection`
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
