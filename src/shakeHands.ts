import Messenger from './Messenger';
import {
  AckMessage,
  Methods,
  Message,
  RemoteProxy,
  SynAckMessage,
  SynMessage,
  Log,
} from './types';
import { ErrorCode, MessageType } from './enums';
import PenpalError from './PenpalError';
import connectCallHandler from './connectCallHandler';
import connectRemoteProxy from './connectRemoteProxy';
import { isAckMessage, isSynAckMessage, isSynMessage } from './guards';
import getPromiseWithResolvers from './getPromiseWithResolvers';
import { extractMethodPathsFromMethods } from './methodSerialization';

type Options = {
  messenger: Messenger;
  methods: Methods;
  initiate: boolean;
  timeout: number | undefined;
  log: Log | undefined;
};

type HandshakeResult<TMethods extends Methods> = {
  remoteProxy: RemoteProxy<TMethods>;
  close: () => void;
};

/**
 * Attempts to establish communication with the remote via a handshake protocol.
 * Typically, this proceeds as follows:
 *
 * Parent                  Child
 *   |  <------- SYN ------- |
 *   |  ----- SYN-ACK -----> |
 *   |  <------- ACK ------- |
 *
 * However, the direction in which the handshake proceeds is dictated by the
 * caller of this function via the `initiate` option.
 *
 * SYN-ACK and ACK messages contain the methods that the remote can call.
 */
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

  const timeoutId =
    timeout !== undefined
      ? setTimeout(() => {
          reject(
            new PenpalError(
              ErrorCode.ConnectionTimeout,
              `Connection timed out after ${timeout}ms`
            )
          );
        }, timeout)
      : undefined;

  const close = () => {
    for (const closeHandler of closeHandlers) {
      closeHandler();
    }
  };

  const connectCallHandlerAndMethodProxies = () => {
    if (isComplete) {
      // If we get here, it means the remote is attempting to re-connect. While
      // that's supported, we don't need to run the rest of this function again.
      return;
    }

    closeHandlers.push(connectCallHandler(messenger, methods, log));

    const { remoteProxy, close: closeMethodProxies } = connectRemoteProxy<
      TMethods
    >(messenger, log);

    closeHandlers.push(closeMethodProxies);

    clearTimeout(timeoutId);
    isComplete = true;

    resolve({
      remoteProxy,
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

    connectCallHandlerAndMethodProxies();
  };

  const handleAckMessage = (message: AckMessage) => {
    log?.(`Received handshake ACK`, message);
    connectCallHandlerAndMethodProxies();
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
