import {
  AckMessage,
  CallSender,
  SerializedMethods,
  SynAckMessage,
  WindowsInfo,
} from '../types';
import { MessageType } from '../enums';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import { Destructor } from '../createDestructor';
import Messenger from '../Messenger';

/**
 * Handles a SYN-ACK handshake message.
 */
const handleSynAckMessageFactory = (
  messenger: Messenger,
  serializedMethods: SerializedMethods,
  destructor: Destructor,
  log: Function
) => {
  const { onDestroy } = destructor;

  const handleSynAckMessage = (message: SynAckMessage): CallSender => {
    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      penpal: MessageType.Ack,
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
