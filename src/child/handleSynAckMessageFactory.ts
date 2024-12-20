import {
  AckMessage,
  CallSender,
  Log,
  SerializedMethods,
  SynAckMessage,
  WindowsInfo,
  Destructor,
} from '../types';
import { MessageType } from '../enums';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import Messenger from '../Messenger';
import namespace from '../namespace';

/**
 * Handles a SYN-ACK handshake message.
 */
const handleSynAckMessageFactory = (
  messenger: Messenger,
  serializedMethods: SerializedMethods,
  destructor: Destructor,
  log: Log
) => {
  const { onDestroy } = destructor;

  const handleSynAckMessage = (message: SynAckMessage): CallSender => {
    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      namespace,
      type: MessageType.Ack,
      methodNames: Object.keys(serializedMethods),
    };

    messenger.sendMessage(ackMessage);

    const info: WindowsInfo = {
      localName: 'Child',
      messenger: messenger,
    };

    const destroyCallReceiver = connectCallReceiver(
      info,
      serializedMethods,
      log
    );
    onDestroy(destroyCallReceiver);

    const callSender: CallSender = {};
    const destroyCallSender = connectCallSender(
      callSender,
      info,
      message.methodNames,
      log
    );
    onDestroy(destroyCallSender);

    return callSender;
  };

  return handleSynAckMessage;
};

export default handleSynAckMessageFactory;
