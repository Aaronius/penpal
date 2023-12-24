import { SerializedMethods, SynAckMessage } from '../types';
import { MessageType } from '../enums';
import CommsAdapter from '../CommsAdapter';

/**
 * Handles a SYN handshake message.
 */
const handleSynMessageFactory = (
  commsAdapter: CommsAdapter,
  log: Function,
  serializedMethods: SerializedMethods
) => {
  const handleSynMessage = () => {
    log('Parent: Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      penpal: MessageType.SynAck,
      methodNames: Object.keys(serializedMethods),
    };

    commsAdapter.sendMessage(synAckMessage);
  };

  return handleSynMessage;
};

export default handleSynMessageFactory;
