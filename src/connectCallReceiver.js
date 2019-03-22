import {
  CALL,
  DATA_CLONE_ERROR,
  FULFILLED,
  MESSAGE,
  REJECTED,
  REPLY
} from './constants';
import { serializeError } from './errorSerialization';

/**
 * Listens for "call" messages coming from the remote, executes the corresponding method, and
 * responds with the return value.
 * @param {Object} info Information about the local and remote windows.
 * @param {Object} methods The keys are the names of the methods that can be called by the remote
 * while the values are the method functions.
 * @param {Promise} destructionPromise A promise resolved when destroy() is called on the penpal
 * connection.
 * @returns {Function} A function that may be called to disconnect the receiver.
 */
export default (info, methods, log) => {
  const { localName, local, remote, remoteOrigin } = info;
  let destroyed = false;

  log(`${localName}: Connecting call receiver`);

  const handleMessageEvent = event => {
    if (
      event.source === remote &&
      event.origin === remoteOrigin &&
      event.data.penpal === CALL
    ) {
      const { methodName, args, id } = event.data;

      log(`${localName}: Received ${methodName}() call`);

      if (methodName in methods) {
        const createPromiseHandler = resolution => {
          return returnValue => {
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

            const message = {
              penpal: REPLY,
              id,
              resolution,
              returnValue
            };

            if (resolution === REJECTED && returnValue instanceof Error) {
              message.returnValue = serializeError(returnValue);
              message.returnValueIsError = true;
            }

            try {
              remote.postMessage(message, remoteOrigin);
            } catch (err) {
              // If a consumer attempts to send an object that's not cloneable (e.g., window),
              // we want to ensure the receiver's promise gets rejected.
              if (err.name === DATA_CLONE_ERROR) {
                remote.postMessage(
                  {
                    penpal: REPLY,
                    id,
                    resolution: REJECTED,
                    returnValue: serializeError(err),
                    returnValueIsError: true
                  },
                  remoteOrigin
                );
              }

              throw err;
            }
          };
        };

        new Promise(resolve =>
          resolve(methods[methodName].apply(methods, args))
        ).then(createPromiseHandler(FULFILLED), createPromiseHandler(REJECTED));
      }
    }
  };

  local.addEventListener(MESSAGE, handleMessageEvent);

  return () => {
    destroyed = true;
    local.removeEventListener(MESSAGE, handleMessageEvent);
  };
};
