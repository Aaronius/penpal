import { serializeError } from './errorSerialization';
import { CallMessage, Methods, ReplyMessage, WindowsInfo } from './types';
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
export default (info: WindowsInfo, methods: Methods, log: Function) => {
  const {
    localName,
    local,
    remote,
    originForSending,
    originForReceiving,
  } = info;
  let destroyed = false;

  const handleMessageEvent = (event: MessageEvent) => {
    if (event.source !== remote || event.data.penpal !== MessageType.Call) {
      return;
    }

    if (event.origin !== originForReceiving) {
      log(
        `${localName} received message from origin ${event.origin} which did not match expected origin ${originForReceiving}`
      );
      return;
    }

    const callMessage: CallMessage = event.data;
    const { methodName, args, id } = callMessage;

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
          remote.postMessage(message, originForSending);
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
            remote.postMessage(errorReplyMessage, originForSending);
          }

          throw err;
        }
      };
    };

    new Promise((resolve) =>
      resolve(methods[methodName].apply(methods, args))
    ).then(
      createPromiseHandler(Resolution.Fulfilled),
      createPromiseHandler(Resolution.Rejected)
    );
  };

  local.addEventListener(NativeEventType.Message, handleMessageEvent);

  return () => {
    destroyed = true;
    local.removeEventListener(NativeEventType.Message, handleMessageEvent);
  };
};
