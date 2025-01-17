import { Log, FlattenedMethods, SynAckMessage, Destructor } from '../types';
import { ErrorCode, MessageType } from '../enums';
import Messenger from '../Messenger';
import PenpalError from '../PenpalError';

const handleSynMessageFactory = (
  messenger: Messenger,
  flattenedMethods: FlattenedMethods,
  destructor: Destructor,
  log: Log
) => {
  const handleSynMessage = () => {
    log('Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      type: MessageType.SynAck,
      methodPaths: Object.keys(flattenedMethods),
    };

    try {
      messenger.sendMessage(synAckMessage);
    } catch (error) {
      destructor.destroy(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
    }
  };

  return handleSynMessage;
};

export default handleSynMessageFactory;
