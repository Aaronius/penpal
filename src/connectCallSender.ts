import generateId from './generateId';
import { deserializeError } from './errorSerialization';
import { deserializeMethods } from './methodSerialization';
import {
  CallSender,
  Log,
  PenpalError,
  PenpalMessage,
  SerializedError,
  WindowsInfo,
} from './types';
import { ErrorCode, MessageType } from './enums';
import MethodCallOptions from './MethodCallOptions';

type ReplyHandler = {
  methodName: string;
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
 * @param methodKeyPaths Key paths of methods available to be called on the remote.
 * @param destructionPromise A promise resolved when destroy() is called on the penpal
 * connection.
 * @param log Logs messages.
 * @returns The call sender object with methods that may be called.
 */
export default (
  callSender: CallSender,
  info: WindowsInfo,
  methodKeyPaths: string[],
  log: Log
) => {
  const { localName, messenger } = info;
  let destroyed = false;

  log(`${localName}: Connecting call sender`);

  const replyHandlers = new Map<number, ReplyHandler>();

  const handleMessage = (message: PenpalMessage) => {
    if (message.penpal !== MessageType.Reply) {
      return;
    }

    const replyHandler = replyHandlers.get(message.roundTripId);

    if (!replyHandler) {
      return;
    }

    replyHandlers.delete(message.roundTripId);

    log(`${localName}: Received ${replyHandler.methodName}() reply`);

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

  const createMethodProxy = (methodName: string) => {
    return (...args: unknown[]) => {
      log(`${localName}: Sending ${methodName}() call`);

      if (destroyed) {
        const error: PenpalError = new Error(
          `Unable to send ${methodName}() call due ` + `to destroyed connection`
        ) as PenpalError;

        error.code = ErrorCode.ConnectionDestroyed;
        throw error;
      }

      const roundTripId = generateId();
      const lastArg = args[args.length - 1];
      const lastArtIsOptions = lastArg instanceof MethodCallOptions;
      const { timeout, transfer: transferables } = lastArtIsOptions
        ? lastArg
        : {};
      const argsWithoutOptions = lastArtIsOptions ? args.slice(0, -1) : args;

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
                `Method call ${methodName}() timed out after ${timeout}ms`
              ) as PenpalError;
              error.code = ErrorCode.MethodCallTimeout;
              replyHandlers.delete(roundTripId);
              reject(error);
            }, timeout)
          : undefined;

        replyHandlers.set(roundTripId, {
          methodName,
          resolve,
          reject,
          timeoutId,
        });

        messenger.sendMessage(
          {
            penpal: MessageType.Call,
            roundTripId,
            methodName,
            args: argsWithoutOptions,
          },
          transferables
        );
      });
    };
  };

  // Wrap each method in a proxy which sends it to the corresponding receiver.
  const flattenedMethods = methodKeyPaths.reduce<
    Record<string, () => Promise<unknown>>
  >((api, name) => {
    api[name] = createMethodProxy(name);
    return api;
  }, {});

  // Unpack the structure of the provided methods object onto the CallSender, exposing
  // the methods in the same shape they were provided.
  Object.assign(callSender, deserializeMethods(flattenedMethods));

  return () => {
    destroyed = true;
    messenger.removeMessageHandler(handleMessage);

    for (const { methodName, reject, timeoutId } of replyHandlers.values()) {
      clearTimeout(timeoutId);
      const error: PenpalError = new Error(
        `Method call ${methodName}() cannot be resolved due to destroyed connection`
      ) as PenpalError;
      error.code = ErrorCode.ConnectionDestroyed;
      reject(error);
    }

    replyHandlers.clear();
  };
};
