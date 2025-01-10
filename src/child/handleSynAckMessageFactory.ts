import {
  AckMessage,
  Log,
  FlattenedMethods,
  SynAckMessage,
  WindowsInfo,
  Destructor,
  Methods,
  RemoteMethodProxies,
} from '../types';
import { MessageType } from '../enums';
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
  const { onDestroy } = destructor;

  const handleSynAckMessage = <TMethods extends Methods>(
    message: SynAckMessage
  ): RemoteMethodProxies<TMethods> => {
    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      type: MessageType.Ack,
      methodPaths: Object.keys(flattenedMethods),
    };

    messenger.sendMessage(ackMessage);

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
