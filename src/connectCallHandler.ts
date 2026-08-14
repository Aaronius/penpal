import { serializeError } from './errorSerialization.js';
import type { Message, ReplyMessage, Methods, Log } from './types.js';
import Reply from './Reply.js';
import type Messenger from './messengers/Messenger.js';
import PenpalError from './PenpalError.js';
import { formatMethodPath, getMethodAtMethodPath } from './methodPath.js';
import { isCallMessage } from './guards.js';
import namespace from './namespace.js';
import {
  asyncIterableIteratorToReadableStream,
  isAsyncIterableIterator,
  type ManagedReadableStream,
} from './asyncIterable.js';

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
 * Listens for "call" messages from the remote, executes the corresponding method,
 * and responds with the return value or error.
 */
const connectCallHandler = (
  messenger: Messenger,
  methods: Methods,
  channel: string | undefined,
  log: Log | undefined,
): (() => void) => {
  let isDestroyed = false;
  const activeIteratorStreams = new Set<ManagedReadableStream>();

  const destroyIteratorStream = (
    iteratorStream: ManagedReadableStream,
    reason: unknown,
  ) => {
    void iteratorStream.destroy(reason).catch((error: unknown) => {
      console.error(error);
    });
  };

  const handleCallMessage = async (message: Message): Promise<void> => {
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
    let iteratorStream: ManagedReadableStream | undefined;

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
        transferables = value.transferables;
        value = await value.value;
      }

      if (isAsyncIterableIterator(value)) {
        try {
          iteratorStream = asyncIterableIteratorToReadableStream(value, () => {
            if (iteratorStream) {
              activeIteratorStreams.delete(iteratorStream);
            }
          });
        } catch (error) {
          try {
            await value.return?.();
          } catch (cleanupError) {
            console.error(cleanupError);
          }
          throw error;
        }

        activeIteratorStreams.add(iteratorStream);
        value = iteratorStream.readableStream;
        transferables = [
          ...(transferables ?? []),
          iteratorStream.readableStream,
        ];
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
      if (iteratorStream) {
        destroyIteratorStream(
          iteratorStream,
          new PenpalError('CONNECTION_DESTROYED', 'Connection destroyed'),
        );
      }
      return;
    }

    try {
      log?.(`Sending ${formatMethodPath(methodPath)}() reply`, replyMessage);
      messenger.sendMessage(replyMessage, transferables);
    } catch (error) {
      if (iteratorStream) {
        destroyIteratorStream(iteratorStream, error);
      }

      // If a consumer attempts to send an object that's not
      // cloneable (e.g., window), we want to ensure the receiver's promise
      // gets rejected.
      if ((error as Error).name === 'DataCloneError') {
        replyMessage = createErrorReplyMessage(channel, callId, error as Error);
        log?.(`Sending ${formatMethodPath(methodPath)}() reply`, replyMessage);
        messenger.sendMessage(replyMessage);
        // Don't return prematurely here, because we still want the error to
        // hit the console so it's easier for developers to notice and debug.
      }

      throw error;
    }
  };

  // Messenger dispatch is synchronous, so start the async work without
  // returning its Promise and handle any rejection here.
  const handleMessage = (message: Message): void => {
    void handleCallMessage(message).catch((error: unknown) => {
      console.error(error);
    });
  };

  messenger.addMessageHandler(handleMessage);

  return () => {
    isDestroyed = true;
    messenger.removeMessageHandler(handleMessage);

    const error = new PenpalError(
      'CONNECTION_DESTROYED',
      'Connection destroyed',
    );

    for (const iteratorStream of activeIteratorStreams) {
      destroyIteratorStream(iteratorStream, error);
    }

    activeIteratorStreams.clear();
  };
};

export default connectCallHandler;
