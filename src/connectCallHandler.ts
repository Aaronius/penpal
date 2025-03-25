import { serializeError } from './errorSerialization.js';
import { Message, ReplyMessage, Methods, Log } from './types.js';
import Reply from './Reply.js';
import Messenger from './messengers/Messenger.js';
import PenpalError from './PenpalError.js';
import {
  formatMethodPath,
  getMethodAtMethodPath,
} from './methodSerialization.js';
import { isCallMessage } from './guards.js';
import namespace from './namespace.js';

const createErrorReplyMessage = (
  channel: string | undefined,
  callId: string,
  error: unknown
): ReplyMessage => ({
  namespace,
  channel,
  type: 'REPLY',
  callId,
  isError: true,
  ...(error instanceof Error
    ? { value: serializeError(error), isSerializedErrorInstance: true }
    : { value: error }),
});

/**
 * Listens for "call" messages from the remote, executes the corresponding method,
 * and responds with the return value or error.
 */
const connectCallHandler = (
  messenger: Messenger,
  methods: Methods,
  channel: string | undefined,
  log: Log | undefined
) => {
  let isDestroyed = false;

  const handleMessage = async (message: Message) => {
    if (isDestroyed) {
      // It's possible to throw an error here, but it would only be catchable
      // using window.onerror since we're in an asynchronously-called function.
      // There is no method call the consumer is making that they could wrap in
      // a try-catch. Even if the consumer were to catch the error somehow,
      // the value of doing so is questionable.
      return;
    }

    if (!isCallMessage(message)) {
      return;
    }

    log?.(`Received ${formatMethodPath(message.methodPath)}() call`, message);

    const { methodPath, args, id: callId } = message;
    let replyMessage: ReplyMessage;
    let transferables: Transferable[] | undefined;

    try {
      const method = getMethodAtMethodPath(methodPath, methods);

      if (!method) {
        throw new PenpalError(
          'METHOD_NOT_FOUND',
          `Method \`${formatMethodPath(methodPath)}\` is not found.`
        );
      }

      let value: unknown = await method(...args);

      if (value instanceof Reply) {
        transferables = value.transferables;
        value = await value.value;
      }

      replyMessage = {
        namespace,
        channel,
        type: 'REPLY',
        callId,
        value,
      };
    } catch (error) {
      replyMessage = createErrorReplyMessage(channel, callId, error);
    }

    // Although we checked this at the beginning of the function, we need to
    // check it again because we've made async calls, and the connection may
    // have been destroyed in the meantime.
    if (isDestroyed) {
      return;
    }

    try {
      log?.(`Sending ${formatMethodPath(methodPath)}() reply`, replyMessage);
      messenger.sendMessage(replyMessage, transferables);
    } catch (error) {
      // If a consumer attempts to send an object that's not
      // cloneable (e.g., window), we want to ensure the receiver's promise
      // gets rejected.
      if ((error as Error).name === 'DataCloneError') {
        replyMessage = createErrorReplyMessage(channel, callId, error as Error);
        log?.(`Sending ${formatMethodPath(methodPath)}() reply`, replyMessage);
        messenger.sendMessage(replyMessage);
      }
      throw error;
    }
  };

  messenger.addMessageHandler(handleMessage);

  return () => {
    isDestroyed = true;
    messenger.removeMessageHandler(handleMessage);
  };
};

export default connectCallHandler;
