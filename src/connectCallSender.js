import { CALL, FULFILLED, MESSAGE, REPLY } from './constants';
import { ERR_CONNECTION_DESTROYED } from './errorCodes';
import generateId from './generateId';
import { deserializeError } from './errorSerialization';

/**
 * Augments an object with methods that match those defined by the remote. When these methods are
 * called, a "call" message will be sent to the remote, the remote's corresponding method will be
 * executed, and the method's return value will be returned via a message.
 * @param {Object} callSender Sender object that should be augmented with methods.
 * @param {Object} info Information about the local and remote windows.
 * @param {Array} methodNames Names of methods available to be called on the remote.
 * @param {Promise} destructionPromise A promise resolved when destroy() is called on the penpal
 * connection.
 * @returns {Object} The call sender object with methods that may be called.
 */
export default (callSender, info, methodNames, destroyConnection, log) => {
  const { localName, local, remote, remoteOrigin } = info;
  let destroyed = false;

  log(`${localName}: Connecting call sender`);

  const createMethodProxy = methodName => {
    return (...args) => {
      log(`${localName}: Sending ${methodName}() call`);

      // This handles the case where the iframe has been removed from the DOM
      // (and therefore its window closed), the consumer has not yet
      // called destroy(), and the user calls a method exposed by
      // the remote. We detect the iframe has been removed and force
      // a destroy() immediately so that the consumer sees the error saying
      // the connection has been destroyed.
      if (remote.closed) {
        destroyConnection();
      }

      if (destroyed) {
        const error = new Error(
          `Unable to send ${methodName}() call due ` + `to destroyed connection`
        );
        error.code = ERR_CONNECTION_DESTROYED;
        throw error;
      }

      return new Promise((resolve, reject) => {
        const id = generateId();
        const handleMessageEvent = event => {
          if (
            event.source === remote &&
            event.origin === remoteOrigin &&
            event.data.penpal === REPLY &&
            event.data.id === id
          ) {
            log(`${localName}: Received ${methodName}() reply`);
            local.removeEventListener(MESSAGE, handleMessageEvent);

            let returnValue = event.data.returnValue;

            if (event.data.returnValueIsError) {
              returnValue = deserializeError(returnValue);
            }

            (event.data.resolution === FULFILLED ? resolve : reject)(
              returnValue
            );
          }
        };

        local.addEventListener(MESSAGE, handleMessageEvent);
        remote.postMessage(
          {
            penpal: CALL,
            id,
            methodName,
            args
          },
          remoteOrigin
        );
      });
    };
  };

  methodNames.reduce((api, methodName) => {
    api[methodName] = createMethodProxy(methodName);
    return api;
  }, callSender);

  return () => {
    destroyed = true;
  };
};
