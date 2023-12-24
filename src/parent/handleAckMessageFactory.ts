import { CallSender, SerializedMethods, WindowsInfo } from '../types';
import { Destructor } from '../createDestructor';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import CommsAdapter from '../CommsAdapter';

/**
 * Handles an ACK handshake message.
 */
const handleAckMessageFactory = (
  commsAdapter: CommsAdapter,
  serializedMethods: SerializedMethods,
  destructor: Destructor,
  log: Function
) => {
  const { onDestroy } = destructor;
  let destroyCallReceiver: Function;
  let receiverMethodNames: string[];
  // We resolve the promise with the call sender. If the child reconnects
  // (for example, after refreshing or navigating to another page that
  // uses Penpal, we'll update the call sender with methods that match the
  // latest provided by the child.
  const callSender: CallSender = {};

  const handleAckMessage = (methodNames: string[]): CallSender => {
    log('Parent: Handshake - Received ACK');

    const info: WindowsInfo = {
      localName: 'Parent',
      commsAdapter,
    };

    // If the child reconnected, we need to destroy the prior call receiver
    // before setting up a new one.
    if (destroyCallReceiver) {
      destroyCallReceiver();
    }

    destroyCallReceiver = connectCallReceiver(info, serializedMethods, log);
    onDestroy(destroyCallReceiver);

    // If the child reconnected, we need to remove the methods from the
    // previous call receiver off the sender.
    if (receiverMethodNames) {
      receiverMethodNames.forEach((receiverMethodName) => {
        delete callSender[receiverMethodName];
      });
    }

    receiverMethodNames = methodNames;

    const destroyCallSender = connectCallSender(
      callSender,
      info,
      receiverMethodNames,
      log
    );

    onDestroy(destroyCallSender);

    return callSender;
  };

  return handleAckMessage;
};

export default handleAckMessageFactory;
