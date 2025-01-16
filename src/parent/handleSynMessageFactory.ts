import {
  Log,
  FlattenedMethods,
  SynAckMessage,
  PenpalError,
  Destructor,
} from '../types';
import { ErrorCode, MessageType } from '../enums';
/**
 * Handles a SYN handshake message.
 */
const handleSynMessageFactory = (
  messenger: Messenger,
  flattenedMethods: FlattenedMethods,
  destructor: Destructor,
  log: Log
) => {
  const handleSynMessage = () => {
    log('Parent: Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      type: MessageType.SynAck,
      methodPaths: Object.keys(flattenedMethods),
    };

    try {
      messenger.sendMessage(synAckMessage);
    } catch (error) {
      const penpalError: PenpalError = new Error(
        (error as Error).message
      ) as PenpalError;
      penpalError.code = ErrorCode.TransmitFailed;
      destructor.destroy(penpalError);
    }
  };

  return handleSynMessage;
};

import Messenger from '../Messenger';

export default handleSynMessageFactory;
