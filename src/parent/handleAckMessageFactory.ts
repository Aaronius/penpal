import {
  CallSender,
  Log,
  SerializedMethods,
  WindowsInfo,
  Destructor,
} from '../types';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import Messenger from '../Messenger';

/**
 * Handles an ACK handshake message.
 */
const handleAckMessageFactory = (
  messenger: Messenger,
  serializedMethods: SerializedMethods,
  destructor: Destructor,
  log: Log
) => {
  const { onDestroy } = destructor;
  let destroyCallReceiverConnection: () => void;
  let destroyCallSenderConnection: () => void;
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
      messenger,
    };

    // If the child reconnected, we need to destroy the prior call receiver
    // connection before setting up a new one.
    if (destroyCallReceiverConnection) {
      destroyCallReceiverConnection();
    }

    // If the child reconnected, we need to destroy the prior call sender
    // connection before setting up a new one.
    if (destroyCallSenderConnection) {
      destroyCallSenderConnection();
    }

    destroyCallReceiverConnection = connectCallReceiver(
      info,
      serializedMethods,
      log
    );
    onDestroy(destroyCallReceiverConnection);

    // If the child reconnected, we need to remove the methods from the
    // previous call receiver off the sender.
    if (receiverMethodNames) {
      receiverMethodNames.forEach((receiverMethodName) => {
        delete callSender[receiverMethodName];
      });
    }

    receiverMethodNames = methodNames;

    destroyCallSenderConnection = connectCallSender(
      callSender,
      info,
      methodNames,
      log
    );

    onDestroy(destroyCallSenderConnection);

    return callSender;
  };

  return handleAckMessage;
};

export default handleAckMessageFactory;
