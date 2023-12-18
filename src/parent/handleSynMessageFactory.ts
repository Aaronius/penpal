import { SerializedMethods, SynAckMessage } from '../types';
import { MessageType } from '../enums';
import CommsAdapter from '../CommsAdapter';

/**
 * Handles a SYN handshake message.
 */
export default (
  commsAdapter: CommsAdapter,
  log: Function,
  serializedMethods: SerializedMethods
) => {
  return () => {
    log('Parent: Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      penpal: MessageType.SynAck,
      methodNames: Object.keys(serializedMethods),
    };

    commsAdapter.sendMessageToRemote(synAckMessage);
  };
};
