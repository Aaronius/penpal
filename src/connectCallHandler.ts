import { serializeError } from './errorSerialization';
import { PenpalMessage, ReplyMessage, Methods } from './types';
import { ErrorCode, MessageType, NativeErrorName } from './enums';
import Reply from './Reply';
import Messenger from './Messenger';
import PenpalError from './PenpalError';
import { getMethodAtMethodPath } from './methodSerialization';

const createErrorReplyMessage = (
  sessionId: number,
  error: Error
): ReplyMessage => ({
  type: MessageType.Reply,
  sessionId,
  value: serializeError(error),
  isError: true,
});

/**
 * Listens for "call" messages from the remote, executes the corresponding method,
 * and responds with the return value or error.
 */
export default (messenger: Messenger, methods: Methods) => {
  let isClosed = false;

  const handleMessage = async (message: PenpalMessage) => {
    if (isClosed) {
      // It's possible to throw an error here, but it would only be catchable
      // using window.onerror since we're in an asynchronously-called function.
      // There is no method call the consumer is making that they could wrap in
      // a try-catch. Even if the consumer were to catch the error somehow,
      // the value of doing so is questionable.
      return;
    }

    if (message.type !== MessageType.Call) {
      return;
    }

    const { methodPath, args, sessionId } = message;
    let replyMessage: ReplyMessage;
    let transferables: Transferable[] | undefined;

    try {
      const method = getMethodAtMethodPath(methodPath, methods);

      if (!method) {
        throw new PenpalError(
          ErrorCode.MethodNotFound,
          `Method \`${methodPath.join('.')}\` is not found.`
        );
      }

      let value: unknown = await method(...args);

      if (value instanceof Reply) {
        transferables = value.transferables;
        value = await value.value;
      }

      replyMessage = {
        type: MessageType.Reply,
        sessionId,
        value,
      };
    } catch (error) {
      replyMessage = createErrorReplyMessage(
        sessionId,
        error instanceof Error
          ? error
          : new Error(error === undefined ? error : String(error))
      );
    }

    // Although we checked this at the beginning of the function, we need to
    // check it again because we've made async calls, and the connection may
    // have been closed in the meantime.
    if (isClosed) {
      return;
    }

    try {
      messenger.sendMessage(replyMessage, transferables);
    } catch (error) {
      // If a consumer attempts to send an object that's not
      // cloneable (e.g., window), we want to ensure the receiver's promise
      // gets rejected.
      if ((error as Error).name === NativeErrorName.DataCloneError) {
        messenger.sendMessage(
          createErrorReplyMessage(sessionId, error as Error)
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
