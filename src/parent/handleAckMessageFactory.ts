import { Log, FlattenedMethods, RemoteMethodProxies, Methods } from '../types';
import connectCallHandler from '../connectCallHandler';
import connectRemoteMethodProxies from '../connectRemoteMethodProxies';
import Messenger from '../Messenger';
import Destructor from '../Destructor';

/**
 * Handles an ACK handshake message.
 */
const handleAckMessageFactory = <TMethods extends Methods>(
  messenger: Messenger,
  flattenedMethods: FlattenedMethods,
  destructor: Destructor,
  log: Log
) => {
  const { onDestroy } = destructor;
  let destroyCallHandler: () => void;
  let destroyRemoteMethodProxies: () => void;
  // We resolve the promise with the call sender. If the child reconnects
  // (for example, after refreshing or navigating to another page that
  // uses Penpal, we'll update the call sender with methods that match the
  // latest provided by the child.
  const remoteMethodProxies = {} as RemoteMethodProxies<TMethods>;

  const handleAckMessage = (
    methodPaths: string[]
  ): RemoteMethodProxies<TMethods> => {
    log('Handshake - Received ACK');

    // If the child reconnected, we need to destroy the prior call receiver
    // connection before setting up a new one.
    if (destroyCallHandler) {
      destroyCallHandler();
    }

    // If the child reconnected, we need to destroy the prior call sender
    // connection before setting up a new one.
    if (destroyRemoteMethodProxies) {
      destroyRemoteMethodProxies();
    }

    destroyCallHandler = connectCallHandler(messenger, flattenedMethods, log);
    onDestroy(() => destroyCallHandler());

    Object.keys(remoteMethodProxies).forEach((key) => {
      delete remoteMethodProxies[key];
    });

    destroyRemoteMethodProxies = connectRemoteMethodProxies(
      remoteMethodProxies,
      messenger,
      methodPaths,
      log
    );

    onDestroy(() => destroyRemoteMethodProxies());

    return remoteMethodProxies;
  };

  return handleAckMessage;
};

export default handleAckMessageFactory;
