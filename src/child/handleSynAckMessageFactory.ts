import {
  AckMessage,
  Log,
  FlattenedMethods,
  SynAckMessage,
  WindowsInfo,
  Destructor,
  Methods,
  RemoteControl,
} from '../types';
import { MessageType } from '../enums';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import Messenger from '../Messenger';

/**
 * Handles a SYN-ACK handshake message.
 */
const handleSynAckMessageFactory = (
  messenger: Messenger,
  flattenedMethods: FlattenedMethods,
  destructor: Destructor,
  log: Log
) => {
  const { onDestroy } = destructor;

  const handleSynAckMessage = <TMethods extends Methods>(
    message: SynAckMessage
  ): RemoteControl<TMethods> => {
    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      type: MessageType.Ack,
      methodPaths: Object.keys(flattenedMethods),
    };

    messenger.sendMessage(ackMessage);

    const info: WindowsInfo = {
      localName: 'Child',
      messenger: messenger,
    };

    const destroyCallReceiver = connectCallReceiver(
      info,
      flattenedMethods,
      log
    );
    onDestroy(destroyCallReceiver);

    const callSender = {} as RemoteControl<TMethods>;
    const destroyCallSender = connectCallSender(
      callSender,
      info,
      message.methodPaths,
      log
    );
    onDestroy(destroyCallSender);

    return callSender;
  };

  return handleSynAckMessage;
};

export default handleSynAckMessageFactory;
