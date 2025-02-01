import Messenger from './Messenger';
import {
  AckMessage,
  MethodPath,
  Methods,
  Message,
  RemoteMethodProxies,
  SynAckMessage,
  SynMessage,
  Log,
} from './types';
import { ErrorCode, MessageType } from './enums';
import PenpalError from './PenpalError';
import connectCallHandler from './connectCallHandler';
import connectMethodProxies from './connectMethodProxies';
import { isAckMessage, isSynAckMessage, isSynMessage } from './guards';
import getPromiseWithResolvers from './getPromiseWithResolvers';
import startConnectionTimeout from './startConnectionTimeout';
import { extractMethodPathsFromMethods } from './methodSerialization';

type Options = {
  messenger: Messenger;
  methods: Methods;
  initiate: boolean;
  timeout: number | undefined;
  log: Log | undefined;
};

type HandshakeResult<TMethods extends Methods> = {
  remoteMethodProxies: RemoteMethodProxies<TMethods>;
  close: () => void;
};

const shakeHands = <TMethods extends Methods>({
  messenger,
  methods,
  initiate,
  timeout,
  log,
}: Options): Promise<HandshakeResult<TMethods>> => {
  const closeHandlers: (() => void)[] = [];
  let isComplete = false;

  const methodPaths = extractMethodPathsFromMethods(methods);

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

  const connectCallHandlerAndMethodProxies = (
    remoteMethodPaths: MethodPath[]
  ) => {
    if (isComplete) {
      // If we get here, it means the remote is attempting to re-connect. While
      // that's supported, Penpal does not support the remote exposing
      // different methods than during the prior connection.
      return;
    }

    closeHandlers.push(connectCallHandler(messenger, methods, log));

    const {
      remoteMethodProxies,
      close: closeMethodProxies,
    } = connectMethodProxies<TMethods>(messenger, remoteMethodPaths, log);

    closeHandlers.push(closeMethodProxies);

    stopConnectionTimeout();
    isComplete = true;

    resolve({
      remoteMethodProxies,
      close,
    });
  };

  const handleSynMessage = (message: SynMessage) => {
    log?.(`Received handshake SYN`, message);
    const synAckMessage: SynAckMessage = {
      type: MessageType.SynAck,
      methodPaths,
    };
    log?.(`Sending handshake SYN-ACK`, synAckMessage);

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
    log?.(`Received handshake SYN-ACK`, message);
    const ackMessage: AckMessage = {
      type: MessageType.Ack,
      methodPaths,
    };
    log?.(`Sending handshake ACK`, ackMessage);

    try {
      messenger.sendMessage(ackMessage);
    } catch (error) {
      reject(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
      return;
    }

    connectCallHandlerAndMethodProxies(message.methodPaths);
  };

  const handleAckMessage = (message: AckMessage) => {
    log?.(`Received handshake ACK`, message);
    connectCallHandlerAndMethodProxies(message.methodPaths);
  };

  const handleMessage = (message: Message) => {
    if (isSynMessage(message)) {
      handleSynMessage(message);
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
    log?.(`Sending handshake SYN`, synMessage);

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
