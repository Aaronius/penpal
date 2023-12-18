import { serializeError } from './errorSerialization';
import {
  CallMessage,
  SerializedMethods,
  ReplyMessage,
  WindowsInfo,
  PenpalMessage,
} from './types';
import {
  MessageType,
  NativeEventType,
  NativeErrorName,
  Resolution,
} from './enums';

/**
 * Listens for "call" messages coming from the remote, executes the corresponding method, and
 * responds with the return value.
 */
export default (
  info: WindowsInfo,
  serializedMethods: SerializedMethods,
  log: Function
) => {
  const { localName, commsAdapter } = info;
  let destroyed = false;

  const handleMessage = (message: PenpalMessage) => {
    if (message.penpal !== MessageType.Call) {
      return;
    }

    const { methodName, args, id } = message;

    log(`${localName}: Received ${methodName}() call`);

    const createPromiseHandler = (resolution: Resolution) => {
      return (returnValue: any) => {
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

        const message: ReplyMessage = {
          penpal: MessageType.Reply,
          id,
          resolution,
          returnValue,
        };

        if (
          resolution === Resolution.Rejected &&
          returnValue instanceof Error
        ) {
          message.returnValue = serializeError(returnValue);
          message.returnValueIsError = true;
        }

        try {
          commsAdapter.sendMessageToRemote(message);
        } catch (err) {
          // If a consumer attempts to send an object that's not cloneable (e.g., window),
          // we want to ensure the receiver's promise gets rejected.
          if (err.name === NativeErrorName.DataCloneError) {
            const errorReplyMessage: ReplyMessage = {
              penpal: MessageType.Reply,
              id,
              resolution: Resolution.Rejected,
              returnValue: serializeError(err),
              returnValueIsError: true,
            };
            commsAdapter.sendMessageToRemote(errorReplyMessage);
          }

          throw err;
        }
      };
    };

    new Promise((resolve) =>
      resolve(serializedMethods[methodName].apply(serializedMethods, args))
    ).then(
      createPromiseHandler(Resolution.Fulfilled),
      createPromiseHandler(Resolution.Rejected)
    );
  };

  commsAdapter.listenForMessagesFromRemote(handleMessage);

  return () => {
    destroyed = true;
    commsAdapter.stopListeningForMessagesFromRemote(handleMessage);
  };
};
