import Messenger from './Messenger';
import {
  AckMessage,
  FlattenedMethods,
  Methods,
  PenpalMessage,
  RemoteMethodProxies,
  SynAckMessage,
  SynMessage,
} from './types';
import { ErrorCode, MessageType } from './enums';
import PenpalError from './PenpalError';
import connectCallHandler from './connectCallHandler';
import connectRemoteMethodProxies from './connectRemoteMethodProxies';
import { isAckMessage, isSynAckMessage, isSynMessage } from './guards';
import getPromiseWithResolvers from './getPromiseWithResolvers';
import startConnectionTimeout from './startConnectionTimeout';

type Options = {
  messenger: Messenger;
  flattenedMethods: FlattenedMethods;
  initiate: boolean;
  timeout: number | undefined;
};

type HandshakeResult<TMethods extends Methods> = {
  remoteMethodProxies: RemoteMethodProxies<TMethods>;
  close: () => void;
};

const shakeHands = <TMethods extends Methods>({
  messenger,
  flattenedMethods,
  initiate,
  timeout,
}: Options): Promise<HandshakeResult<TMethods>> => {
  const closeHandlers: (() => void)[] = [];
  let isComplete = false;

  const { promise, resolve, reject } = getPromiseWithResolvers<
    HandshakeResult<TMethods>,
    PenpalError
  >();

  const stopConnectionTimeout = startConnectionTimeout(timeout, reject);

  const close = () => {
    for (const closeHandler of closeHandlers) {
      closeHandler();
    }
  };

  const connectCallHandlerAndRemoteMethodProxies = (methodPaths: string[]) => {
    if (isComplete) {
      // If we get here, it means the remote is attempting to re-connect. While
      // that's supported, Penpal does not support the remote exposing
      // different methods than during the prior connection.
      return;
    }

    closeHandlers.push(connectCallHandler(messenger, flattenedMethods));

    const {
      remoteMethodProxies,
      close: closeRemoteMethodProxies,
    } = connectRemoteMethodProxies<TMethods>(messenger, methodPaths);

    closeHandlers.push(closeRemoteMethodProxies);

    stopConnectionTimeout();
    isComplete = true;

    resolve({
      remoteMethodProxies,
      close,
    });
  };

  const handleSynMessage = () => {
    const synAckMessage: SynAckMessage = {
      type: MessageType.SynAck,
      methodPaths: Object.keys(flattenedMethods),
    };

    try {
      messenger.sendMessage(synAckMessage);
    } catch (error) {
      reject(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
      return;
    }
  };

  const handleSynAckMessage = (message: SynAckMessage) => {
    const ackMessage: AckMessage = {
      type: MessageType.Ack,
      methodPaths: Object.keys(flattenedMethods),
    };

    try {
      messenger.sendMessage(ackMessage);
    } catch (error) {
      reject(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
      return;
    }

    connectCallHandlerAndRemoteMethodProxies(message.methodPaths);
  };

  const handleAckMessage = (message: AckMessage) => {
    connectCallHandlerAndRemoteMethodProxies(message.methodPaths);
  };

  const handleMessage = (message: PenpalMessage) => {
    if (isSynMessage(message)) {
      handleSynMessage();
    }

    if (isSynAckMessage(message)) {
      handleSynAckMessage(message);
    }

    if (isAckMessage(message)) {
      handleAckMessage(message);
    }
  };

  messenger.addMessageHandler(handleMessage);
  closeHandlers.push(() => messenger.removeMessageHandler(handleMessage));

  if (initiate) {
    const synMessage: SynMessage = {
      type: MessageType.Syn,
    };

    try {
      messenger.sendMessage(synMessage);
    } catch (error) {
      reject(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
    }
  }

  return promise;
};

export default shakeHands;
