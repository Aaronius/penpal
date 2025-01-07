import {
  Log,
  FlattenedMethods,
  WindowsInfo,
  Destructor,
  RemoteControl,
  Methods,
} from '../types';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import Messenger from '../Messenger';

/**
 * Handles an ACK handshake message.
 */
const handleAckMessageFactory = <TMethods extends Methods>(
  messenger: Messenger,
  flattenedMethods: FlattenedMethods,
  channel: string | undefined,
  destructor: Destructor,
  log: Log
) => {
  const { onDestroy } = destructor;
  let destroyCallReceiverConnection: () => void;
  let destroyCallSenderConnection: () => void;
  let receiverMethodPaths: string[];
  // We resolve the promise with the call sender. If the child reconnects
  // (for example, after refreshing or navigating to another page that
  // uses Penpal, we'll update the call sender with methods that match the
  // latest provided by the child.
  const callSender = {} as RemoteControl<TMethods>;

  const handleAckMessage = (methodPaths: string[]): RemoteControl<TMethods> => {
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
      channel,
      flattenedMethods,
      log
    );
    onDestroy(destroyCallReceiverConnection);

    Object.keys(callSender).forEach((key) => {
      delete callSender[key];
    });

    // If the child reconnected, we need to remove the methods from the
    // previous call receiver off the sender.
    if (receiverMethodPaths) {
      receiverMethodPaths.forEach((receiverMethodName) => {
        delete callSender[receiverMethodName];
      });
    }

    destroyCallSenderConnection = connectCallSender(
      callSender,
      info,
      methodPaths,
      channel,
      log
    );

    onDestroy(destroyCallSenderConnection);

    return callSender;
  };

  return handleAckMessage;
};

export default handleAckMessageFactory;
