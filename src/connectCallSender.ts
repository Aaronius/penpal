import generateId from './generateId';
import { deserializeError } from './errorSerialization';
import { unflattenMethods } from './methodSerialization';
import {
  Log,
  PenpalError,
  PenpalMessage,
  SerializedError,
  WindowsInfo,
  RemoteControl,
} from './types';
import { ErrorCode, MessageType } from './enums';
import MethodCallOptions from './MethodCallOptions';

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
 * @param callSender Sender object that should be augmented with methods.
 * @param info Information about the local and remote windows.
 * @param methodPaths Key paths of methods available to be called on the remote.
 * @param log Logs messages.
 * @returns The call sender object with methods that may be called.
 */
export default (
  callSender: RemoteControl,
  info: WindowsInfo,
  methodPaths: string[],
  log: Log
) => {
  const { localName, messenger } = info;
  let destroyed = false;

  log(`${localName}: Connecting call sender`);

  const replyHandlers = new Map<number, ReplyHandler>();

  const handleMessage = (message: PenpalMessage) => {
    if (message.type !== MessageType.Reply) {
      return;
    }

    const replyHandler = replyHandlers.get(message.roundTripId);

    if (!replyHandler) {
      return;
    }

    replyHandlers.delete(message.roundTripId);

    log(`${localName}: Received ${replyHandler.methodPath}() reply`);

    if (message.isError) {
      const error = message.isSerializedErrorInstance
        ? deserializeError(message.error as SerializedError)
        : message.error;
      replyHandler.reject(error);
    } else {
      replyHandler.resolve(message.returnValue);
    }
  };

  messenger.addMessageHandler(handleMessage);

  const createMethodProxy = (methodPath: string) => {
    return (...args: unknown[]) => {
      log(`${localName}: Sending ${methodPath}() call`);

      if (destroyed) {
        const error: PenpalError = new Error(
          `Unable to send ${methodPath}() call due ` + `to destroyed connection`
        ) as PenpalError;

        error.code = ErrorCode.ConnectionDestroyed;
        throw error;
      }

      const roundTripId = generateId();
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
              const error: PenpalError = new Error(
                `Method call ${methodPath}() timed out after ${timeout}ms`
              ) as PenpalError;
              error.code = ErrorCode.MethodCallTimeout;
              replyHandlers.delete(roundTripId);
              reject(error);
            }, timeout)
          : undefined;

        replyHandlers.set(roundTripId, {
          methodPath,
          resolve,
          reject,
          timeoutId,
        });

        messenger.sendMessage(
          {
            type: MessageType.Call,
            roundTripId,
            methodPath,
            args: argsWithoutOptions,
          },
          transferables
        );
      });
    };
  };

  // Wrap each method in a proxy which sends it to the corresponding receiver.
  const flattenedMethods = methodPaths.reduce<
    Record<string, () => Promise<unknown>>
  >((memo, methodPath) => {
    memo[methodPath] = createMethodProxy(methodPath);
    return memo;
  }, {});

  // Unpack the structure of the provided methods object onto the CallSender, exposing
  // the methods in the same shape they were provided.
  Object.assign(callSender, unflattenMethods(flattenedMethods));

  return () => {
    destroyed = true;
    messenger.removeMessageHandler(handleMessage);

    for (const { methodPath, reject, timeoutId } of replyHandlers.values()) {
      clearTimeout(timeoutId);
      const error: PenpalError = new Error(
        `Method call ${methodPath}() cannot be resolved due to destroyed connection`
      ) as PenpalError;
      error.code = ErrorCode.ConnectionDestroyed;
      reject(error);
    }

    replyHandlers.clear();
  };
};
