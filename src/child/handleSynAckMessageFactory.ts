import {
  AckMessage,
  CallSender,
  PenpalMessage,
  SerializedMethods,
  SynAckMessage,
  WindowsInfo,
} from '../types';
import { MessageType } from '../enums';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import { Destructor } from '../createDestructor';
import isWorker from '../isWorker';
import CommsAdapter from '../CommsAdapter';

/**
 * Handles a SYN-ACK handshake message.
 */
export default (
  commsAdapter: CommsAdapter,
  parentOrigin: string | RegExp,
  serializedMethods: SerializedMethods,
  destructor: Destructor,
  log: Function
) => {
  const { destroy, onDestroy } = destructor;

  const handleAckMessage = (message: SynAckMessage): CallSender => {
    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      penpal: MessageType.Ack,
      methodNames: Object.keys(serializedMethods),
    };

    commsAdapter.sendMessageToRemote(ackMessage);

    const info: WindowsInfo = {
      localName: 'Child',
      commsAdapter: commsAdapter,
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

  return handleAckMessage;
};
