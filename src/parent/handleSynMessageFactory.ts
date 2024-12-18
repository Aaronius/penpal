import { Log, SerializedMethods, SynAckMessage } from '../types';
import { MessageType } from '../enums';
import Messenger from '../Messenger';

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
      penpal: MessageType.SynAck,
      methodNames: Object.keys(serializedMethods),
    };

    messenger.sendMessage(synAckMessage);
  };

  return handleSynMessage;
};

export default handleSynMessageFactory;
