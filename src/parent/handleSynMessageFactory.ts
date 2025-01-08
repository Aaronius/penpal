import { Log, FlattenedMethods, SynAckMessage } from '../types';
import { MessageType } from '../enums';
import Messenger from '../Messenger';

/**
 * Handles a SYN handshake message.
 */
const handleSynMessageFactory = (
  messenger: Messenger,
  log: Log,
  flattenedMethods: FlattenedMethods
) => {
  const handleSynMessage = () => {
    log('Parent: Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      type: MessageType.SynAck,
      methodPaths: Object.keys(flattenedMethods),
    };

    messenger.sendMessage(synAckMessage);
  };

  return handleSynMessage;
};

export default handleSynMessageFactory;
