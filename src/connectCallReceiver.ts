import { serializeError } from './errorSerialization';
import {
  PenpalMessage,
  ReplyMessage,
  SerializedMethods,
  WindowsInfo,
} from './types';
import { MessageType, NativeErrorName, Resolution } from './enums';
import Reply from './Reply';

/**
 * Listens for "call" messages coming from the remote, executes the corresponding method, and
 * responds with the return value.
 */
export default (
  info: WindowsInfo,
  serializedMethods: SerializedMethods,
  log: Function
) => {
  const { localName, messenger } = info;
  let destroyed = false;

  const createMethodCallResultHandler = (
    methodName: string,
    messageId: number,
    resolution: Resolution
  ) => {
    return (returnValue: unknown) => {
      log(`${localName}: Sending ${methodName}() reply`);

      if (destroyed) {
        // It's possible to throw an error here, but it would need to be thrown asynchronously
        // and would only be catchable using window.onerror. This is because the consumer
        // is merely returning a value from their method and not calling any function
        // that they could wrap in a try-catch. Even if the consumer were to catch the error,
        // the value of doing so is questionable. Instead, we'll just log a message.
        log(
          `${localName}: Unable to send ${methodName}() reply due to destroyed connection`
        );
        return;
      }

      let transferables: Transferable[] | undefined;
      let methodCallReturnValue = returnValue;

      if (returnValue instanceof Reply) {
        transferables = returnValue.messageOptions?.options.transfer;
        methodCallReturnValue = returnValue.returnValue;
      }

      const message: ReplyMessage = {
        penpal: MessageType.Reply,
        id: messageId,
        resolution,
        returnValue: methodCallReturnValue,
      };

      if (
        resolution === Resolution.Rejected &&
        methodCallReturnValue instanceof Error
      ) {
        message.returnValue = serializeError(methodCallReturnValue);
        message.returnValueIsError = true;
      }

      try {
        messenger.sendMessage(message, transferables);
      } catch (err) {
        // If a consumer attempts to send an object that's not cloneable (e.g., window),
        // we want to ensure the receiver's promise gets rejected.
        if ((err as Error).name === NativeErrorName.DataCloneError) {
          const errorReplyMessage: ReplyMessage = {
            penpal: MessageType.Reply,
            id: messageId,
            resolution: Resolution.Rejected,
            returnValue: serializeError(err as Error),
            returnValueIsError: true,
          };
          messenger.sendMessage(errorReplyMessage, transferables);
        }

        throw err;
      }
    };
  };

  const handleMessage = (message: PenpalMessage) => {
    if (message.penpal !== MessageType.Call) {
      return;
    }

    const { methodName, args, id } = message;

    log(`${localName}: Received ${methodName}() call`);

    new Promise((resolve) =>
      resolve(serializedMethods[methodName].apply(serializedMethods, args))
    ).then(
      createMethodCallResultHandler(methodName, id, Resolution.Fulfilled),
      createMethodCallResultHandler(methodName, id, Resolution.Rejected)
    );
  };

  messenger.addMessageHandler(handleMessage);

  return () => {
    destroyed = true;
    messenger.removeMessageHandler(handleMessage);
  };
};
