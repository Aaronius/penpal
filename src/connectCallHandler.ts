import { serializeError } from './errorSerialization';
import { Log, PenpalMessage, ReplyMessage, FlattenedMethods } from './types';
import { MessageType, NativeErrorName } from './enums';
import Reply from './Reply';
import Messenger from './Messenger';

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
  messenger: Messenger,
  flattenedMethods: FlattenedMethods,
  log: Log
) => {
  let isClosed = false;

  const handleMessage = async (message: PenpalMessage) => {
    if (message.type !== MessageType.Call) return;

    const { methodPath, args, roundTripId } = message;

    log(`Received ${methodPath}() call`);

    let replyMessage: ReplyMessage;
    let transferables: Transferable[] | undefined;

    try {
      let value = await flattenedMethods[methodPath](...args);

      if (value instanceof Reply) {
        transferables = value.transferables;
        value = await value.value;
      }

      replyMessage = {
        type: MessageType.Reply,
        roundTripId,
        value,
      };
    } catch (error) {
      replyMessage = createErrorReplyMessage(roundTripId, error);
    }

    if (isClosed) {
      // It's possible to throw an error here, but it would catchable using
      // window.onerror since we're in an asynchronously called function. There
      // is no method call the consumer is making that they could wrap in
      // a try-catch. Even if the consumer were to catch the error somehow,
      // the value of doing so is questionable.
      log(`Unable to send ${methodPath}() reply due to closed connection`);
      return;
    }

    log(`Sending ${methodPath}() reply`);

    try {
      messenger.sendMessage(replyMessage, transferables);
    } catch (error) {
      // If a consumer attempts to send an object that's not
      // cloneable (e.g., window), we want to ensure the receiver's promise
      // gets rejected.
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
    isClosed = true;
    messenger.removeMessageHandler(handleMessage);
  };
};
