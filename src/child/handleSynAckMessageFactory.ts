import {
  AckMessage,
  Log,
  FlattenedMethods,
  SynAckMessage,
  WindowsInfo,
  Destructor,
  Methods,
  Remote,
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
  flattenedMethods: FlattenedMethods,
  destructor: Destructor,
  log: Log
) => {
  const { onDestroy } = destructor;

  const handleSynAckMessage = <TMethods extends Methods>(
    message: SynAckMessage
  ): Remote<TMethods> => {
    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      namespace,
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

    const callSender = {} as Remote<TMethods>;
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
