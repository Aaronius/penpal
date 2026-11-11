import { serializeError } from './errorSerialization.js';
import type {
  CallMessage,
  Log,
  PenpalTransferable,
  ReplyMessage,
} from './types.js';
import Reply from './Reply.js';
import type Messenger from './messengers/Messenger.js';
import PenpalError from './PenpalError.js';
import { formatMethodPath, getMethodAtMethodPath } from './methodPath.js';
import namespace from './namespace.js';

export type CallHandler = {
  handleMessage: (message: CallMessage) => void;
  destroy: () => void;
};

const createErrorReplyMessage = (
  channel: string | undefined,
  callId: string,
  error: unknown,
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
 * Handles "call" messages from the remote, executes the corresponding method,
 * and responds with the return value or error.
 */
const connectCallHandler = (
  messenger: Messenger,
  methods: object,
  channel: string | undefined,
  log: Log | undefined,
): CallHandler => {
  let isDestroyed = false;

  const handleCallMessage = async (message: CallMessage): Promise<void> => {
    log?.(`Received ${formatMethodPath(message.methodPath)}() call`, message);

    const { methodPath, args, id: callId } = message;
    let replyMessage: ReplyMessage;
    let transferables: PenpalTransferable[] | undefined;

    try {
      const method = getMethodAtMethodPath(methodPath, methods);

      if (!method) {
        throw new PenpalError(
          'METHOD_NOT_FOUND',
          `Method \`${formatMethodPath(methodPath)}\` is not found.`,
        );
      }

      let value: unknown = await method(...args);

      if (value instanceof Reply) {
        const reply = value;
        value = await reply.value;
        transferables = reply.transferables;
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

    // connect() calls this handler's destroy() when the connection closes
    // or a new remote starts a handshake. Either can happen while we wait
    // for the result. Drop the reply so it can't go out on a closed
    // connection or reach a remote that never made the call.
    if (isDestroyed) {
      return;
    }

    try {
      log?.(`Sending ${formatMethodPath(methodPath)}() reply`, replyMessage);
      messenger.sendMessage(replyMessage, transferables);
    } catch (error) {
      // If the return value can't be cloned (for example, it's a Window),
      // send an error reply so the caller's promise can reject.
      if ((error as Error).name === 'DataCloneError') {
        replyMessage = createErrorReplyMessage(channel, callId, error as Error);
        log?.(`Sending ${formatMethodPath(methodPath)}() reply`, replyMessage);
        messenger.sendMessage(replyMessage);
        // Throw below so handleMessage() also logs the error where the
        // method ran.
      }

      throw error;
    }
  };

  return {
    handleMessage: (message) => {
      // Return control to the messenger while we wait for the local method
      // to finish, so it can deliver other messages in the meantime.
      void handleCallMessage(message).catch((error: unknown) => {
        // If the local method requested by the remote throws or rejects,
        // Penpal puts that error in the reply. If sending the reply fails,
        // for example, log the failure here. Throwing here would create an
        // unhandled rejection.
        console.error(error);
      });
    },
    destroy: () => {
      isDestroyed = true;
    },
  };
};

export default connectCallHandler;
