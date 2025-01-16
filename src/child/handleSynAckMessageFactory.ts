import {
  AckMessage,
  Log,
  FlattenedMethods,
  SynAckMessage,
  WindowsInfo,
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
    log('Child: Handshake - Received SYN-ACK, responding with ACK');

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
      penpalError.code = ErrorCode.TransmitFailed;
      destroy(penpalError);
    }

    const info: WindowsInfo = {
      localName: 'Child',
      messenger: messenger,
    };

    const destroyCallHandler = connectCallHandler(info, flattenedMethods, log);
    onDestroy(destroyCallHandler);

    const remoteMethodProxies = {} as RemoteMethodProxies<TMethods>;
    const destroyRemoteMethodProxies = connectRemoteMethodProxies(
      remoteMethodProxies,
      info,
      message.methodPaths,
      log
    );
    onDestroy(destroyRemoteMethodProxies);

    return remoteMethodProxies;
  };

  return handleSynAckMessage;
};

export default handleSynAckMessageFactory;
