import { serializeError } from './errorSerialization';
import {
  Log,
  PenpalMessage,
  ReplyMessage,
  FlattenedMethods,
  WindowsInfo,
} from './types';
import { MessageType, NativeErrorName } from './enums';
import Reply from './Reply';

const createErrorReplyMessage = (
  roundTripId: number,
  error: unknown
): ReplyMessage => ({
  type: MessageType.Reply,
  roundTripId,
  isError: true,
  error: error instanceof Error ? serializeError(error) : error,
  isSerializedErrorInstance: error instanceof Error,
});

/**
 * Listens for "call" messages from the remote, executes the corresponding method,
 * and responds with the return value or error.
 */
export default (
  { localName, messenger }: WindowsInfo,
  flattenedMethods: FlattenedMethods,
  log: Log
) => {
  let destroyed = false;

  const handleMessage = async (message: PenpalMessage) => {
    if (message.type !== MessageType.Call) return;

    const { methodPath, args, roundTripId } = message;

    log(`${localName}: Received ${methodPath}() call`);

    let replyMessage: ReplyMessage;
    let transferables: Transferable[] | undefined;

    try {
      let returnValue = await flattenedMethods[methodPath](...args);

      if (returnValue instanceof Reply) {
        transferables = returnValue.transfer;
        returnValue = await returnValue.returnValue;
      }

      replyMessage = {
        type: MessageType.Reply,
        roundTripId,
        returnValue,
      };
    } catch (error) {
      replyMessage = createErrorReplyMessage(roundTripId, error);
    }

    if (destroyed) {
      // It's possible to throw an error here, but it would need to be thrown asynchronously
      // and would only be catchable using window.onerror. This is because the consumer
      // is merely returning a value from their method and not calling any function
      // that they could wrap in a try-catch. Even if the consumer were to catch the error,
      // the value of doing so is questionable. Instead, we'll just log a message.
      log(
        `${localName}: Unable to send ${methodPath}() reply due to destroyed connection`
      );
      return;
    }

    log(`${localName}: Sending ${methodPath}() reply`);

    try {
      messenger.sendMessage(replyMessage, transferables);
    } catch (error) {
      // If a consumer attempts to send an object that's not cloneable (e.g., window),
      // we want to ensure the receiver's promise gets rejected.
      if ((error as Error).name === NativeErrorName.DataCloneError) {
        messenger.sendMessage(
          createErrorReplyMessage(roundTripId, error as Error)
        );
      }
      throw error;
    }
  };

  messenger.addMessageHandler(handleMessage);

  return () => {
    destroyed = true;
    messenger.removeMessageHandler(handleMessage);
  };
};
