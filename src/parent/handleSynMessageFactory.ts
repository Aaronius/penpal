import { Log, SerializedMethods, SynAckMessage } from '../types';
import { MessageType } from '../enums';
import Messenger from '../Messenger';
import namespace from '../namespace';

/**
 * Handles a SYN handshake message.
 */
const handleSynMessageFactory = (
  messenger: Messenger,
  log: Log,
  serializedMethods: SerializedMethods
) => {
  const handleSynMessage = () => {
    log('Parent: Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      namespace,
      type: MessageType.SynAck,
      methodNames: Object.keys(serializedMethods),
    };

    messenger.sendMessage(synAckMessage);
  };

  return handleSynMessage;
};

export default handleSynMessageFactory;
