import {
  AckMessage,
  Log,
  FlattenedMethods,
  SynAckMessage,
  Destructor,
  Methods,
  RemoteMethodProxies,
  PenpalError,
} from '../types';
import { ErrorCode, MessageType } from '../enums';
import connectCallHandler from '../connectCallHandler';
import connectRemoteMethodProxies from '../connectRemoteMethodProxies';
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
  const { onDestroy, destroy } = destructor;

  const handleSynAckMessage = <TMethods extends Methods>(
    message: SynAckMessage
  ): RemoteMethodProxies<TMethods> => {
    log('Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      type: MessageType.Ack,
      methodPaths: Object.keys(flattenedMethods),
    };

    try {
      messenger.sendMessage(ackMessage);
    } catch (error) {
      const penpalError: PenpalError = new Error(
        (error as Error).message
      ) as PenpalError;
      penpalError.code = ErrorCode.TransmissionFailed;
      destroy(penpalError);
    }

    const destroyCallHandler = connectCallHandler(
      messenger,
      flattenedMethods,
      log
    );
    onDestroy(destroyCallHandler);

    const remoteMethodProxies = {} as RemoteMethodProxies<TMethods>;
    const destroyRemoteMethodProxies = connectRemoteMethodProxies(
      remoteMethodProxies,
      messenger,
      message.methodPaths,
      log
    );
    onDestroy(destroyRemoteMethodProxies);

    return remoteMethodProxies;
  };

  return handleSynAckMessage;
};

export default handleSynAckMessageFactory;
