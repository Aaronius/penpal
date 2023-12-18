import {
  CallSender,
  PenpalError,
  AsyncMethodReturns,
  Connection,
  Methods,
  PenpalMessage,
} from '../types';
import { ErrorCode, MessageType, NativeEventType } from '../enums';

import createDestructor from '../createDestructor';
import createLogger from '../createLogger';
import getOriginFromSrc from './getOriginFromSrc';
import handleAckMessageFactory from './handleAckMessageFactory';
import handleSynMessageFactory from './handleSynMessageFactory';
import { serializeMethods } from '../methodSerialization';
import monitorIframeRemoval from './monitorIframeRemoval';
import startConnectionTimeout from '../startConnectionTimeout';
import validateIframeHasSrcOrSrcDoc from './validateIframeHasSrcOrSrcDoc';
import isWorker from '../isWorker';
import ParentToIframeAdapter from '../ParentToIframeAdapter';
import CommsAdapter from '../CommsAdapter';

type Options = {
  /**
   * The iframe to which a connection should be made.
   */
  child: HTMLIFrameElement | Worker;
  /**
   * Methods that may be called by the iframe.
   */
  methods?: Methods;
  /**
   * The child origin to use to secure communication. If
   * not provided, the child origin will be derived from the
   * iframe's src or srcdoc value.
   */
  childOrigin?: string;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the iframe to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

/**
 * Attempts to establish communication with an iframe.
 */
export default <TCallSender extends object = CallSender>(
  options: Options
): Connection<TCallSender> => {
  let { child, methods = {}, childOrigin, timeout, debug = false } = options;

  const log = createLogger(debug);
  const destructor = createDestructor('Parent', log);
  const { onDestroy, destroy } = destructor;

  let commsAdapter: CommsAdapter;

  // if (child instanceof HTMLIFrameElement) {
  commsAdapter = new ParentToIframeAdapter(
    child as HTMLIFrameElement,
    childOrigin,
    log,
    destructor
  );
  // } else if (child instanceof Worker) {
  //   // TODO
  // } else {
  //   // TODO
  // }

  const serializedMethods = serializeMethods(methods);
  const handleSynMessage = handleSynMessageFactory(
    commsAdapter,
    log,
    serializedMethods
  );
  const handleAckMessage = handleAckMessageFactory(
    commsAdapter,
    serializedMethods,
    destructor,
    log
  );

  const promise: Promise<AsyncMethodReturns<TCallSender>> = new Promise(
    (resolve, reject) => {
      const stopConnectionTimeout = startConnectionTimeout(timeout, destroy);
      const handleMessage = (message: PenpalMessage) => {
        if (message.penpal === MessageType.Syn) {
          handleSynMessage();
          return;
        }

        if (message.penpal === MessageType.Ack) {
          const callSender = handleAckMessage(
            message.methodNames
          ) as AsyncMethodReturns<TCallSender>;

          if (callSender) {
            stopConnectionTimeout();
            resolve(callSender);
          }
          return;
        }
      };

      commsAdapter.listenForMessagesFromRemote(handleMessage);

      log('Parent: Awaiting handshake');

      onDestroy((error?: PenpalError) => {
        commsAdapter.stopListeningForMessagesFromRemote(handleMessage);

        if (error) {
          reject(error);
        }
      });
    }
  );

  return {
    promise,
    destroy() {
      // Don't allow consumer to pass an error into destroy.
      destroy();
    },
  };
};
