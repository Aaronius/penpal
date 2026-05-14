import Messenger from './messengers/Messenger.js';
import {
  Ack2Message,
  Methods,
  Message,
  RemoteProxy,
  Ack1Message,
  SynMessage,
  Log,
} from './types.js';
import PenpalError from './PenpalError.js';
import connectCallHandler from './connectCallHandler.js';
import connectRemoteProxy from './connectRemoteProxy.js';
import { isAck2Message, isAck1Message, isSynMessage } from './guards.js';
import generateId from './generateId.js';
import namespace from './namespace.js';

type Options = {
  messenger: Messenger;
  methods: Methods;
  timeout: number | undefined;
  channel: string | undefined;
  log: Log | undefined;
};

type Handshake<TMethods extends Methods> = {
  promise: Promise<RemoteProxy<TMethods>>;
  destroy: () => void;
};

/**
 * Attempts to establish communication with the remote via a handshake protocol.
 * The handshake protocol fulfills a few requirements:
 *
 * 1. One participant in the handshake may not be available when the other
 *    participant starts the handshake. For example, a document inside an iframe
 *    may not be loaded when the parent window starts a handshake.
 * 2. While #1 could be solved by having the consumer of Penpal specify which
 *    participant should initiate the handshake, we'd rather avoid this
 *    unnecessary cognitive load.
 * 3. While #1 could be solved by having the consumer of Penpal specify which
 *    participant is the "parent" or "child" and then having Penpal assume
 *    the child should initiate the handshake, we'd rather avoid parent-child
 *    terminology since Penpal can support communication between two
 *    participants where neither would be considered a parent nor child. It may
 *    also be too presumptive that the child should always initiate the
 *    handshake.
 * 4. For robustness, each participant must know that the other participant is
 *    receiving its messages for the handshake to be considered complete.
 * 5. The handshake should support a participant attempting to
 *    re-establish the connection. This can occur, for example, if an end user
 *    were to right-click within an iframe and click reload.
 * 6. The handshake should allow a Messenger to easily attach something to
 *    a handshake message from one participant to the other unidirectionally
 *    (rather than from both participants to each other).
 *    This is important when a participant needs to be in charge of, for
 *    example, creating a MessageChannel and sending one MessagePort from the
 *    MessagePort pair to the other participant. If both participants attempted
 *    to do this it could lead to confusion.
 * 7. The handshake ideally shouldn't require sending handshake messages on an
 *    interval (retrying until the other participant is ready to receive them).
 *    Intervals can increase compute resources if the interval is too short
 *    or increase latency if the interval is too long. While we could make this
 *    configurable, it's additional mental load for the consumer. Additionally,
 *    setInterval and setTimeout are not available within some contexts
 *    (like AudioWorklet), where a consumer may like to use Penpal.
 *
 * To accomplish these requirements, the handshake protocol is as follows:
 * 1. Each participant generates a random participant ID.
 * 2. As soon as possible, each participant sends a SYN message containing its
 *    participant ID to the other participant.
 * 3. When the SYN messages were sent, one of the participants may not have
 *    been ready to receive the SYN message from the other. At least one
 *    of the participants was ready, however, and should have received a SYN
 *    message from the other participant. Each participant that did receive
 *    a SYN message knows for sure that the other participant is now ready
 *    to receive a SYN message, so it will send another SYN message in case
 *    the other participant did not receive the first SYN message. This
 *    ultimately results in each participant sending two SYN messages.
 * 4. Each participant now should have received at least one SYN message from
 *    the other participant. Each participant compares their own ID with the
 *    other participant's ID. Whichever participant has the higher ID
 *    (using a simple string comparison) is considered the handshake leader
 *    and will send an ACK1 message to the other participant.
 * 5. At this point, the handshake leader does not know whether the other
 *    participant is actually receiving messages. The participant receiving
 *    the ACK1 message will respond with an ACK2, informing the handshake
 *    leader that it is indeed receiving messages.
 * 6. At this point, both participants know the other is receiving messages
 *    and the handshake is complete.
 */
const shakeHands = <TMethods extends Methods>({
  messenger,
  methods,
  timeout,
  channel,
  log,
}: Options): Handshake<TMethods> => {
  const participantId = generateId();
  let remoteParticipantId: string;
  const destroyHandlers: (() => void)[] = [];
  let isComplete = false;
  let isDestroyed = false;

  const { promise, resolve, reject } =
    Promise.withResolvers<RemoteProxy<TMethods>>();

  const timeoutId =
    timeout !== undefined
      ? setTimeout(() => {
          rejectAndCleanUp(
            new PenpalError(
              'CONNECTION_TIMEOUT',
              `Connection timed out after ${timeout}ms`,
            ),
          );
        }, timeout)
      : undefined;

  const cleanUp = () => {
    clearTimeout(timeoutId);

    for (const destroyHandler of destroyHandlers.splice(0)) {
      destroyHandler();
    }
  };

  const rejectAndCleanUp = (error: PenpalError) => {
    if (isDestroyed) {
      return;
    }

    isDestroyed = true;
    cleanUp();
    reject(error);
  };

  const destroy = () => {
    rejectAndCleanUp(
      new PenpalError('CONNECTION_DESTROYED', 'Connection destroyed'),
    );
  };

  const completeHandshake = () => {
    if (isDestroyed || isComplete) {
      // Ignore messages after cleanup, and keep completion idempotent when
      // the remote attempts to re-connect.
      return;
    }

    destroyHandlers.push(connectCallHandler(messenger, methods, channel, log));

    const { remoteProxy, destroy: destroyMethodProxies } =
      connectRemoteProxy<TMethods>(messenger, channel, log);

    destroyHandlers.push(destroyMethodProxies);

    clearTimeout(timeoutId);
    isComplete = true;

    resolve(remoteProxy);
  };

  const sendHandshakeMessage = (
    message: SynMessage | Ack1Message | Ack2Message,
  ) => {
    if (isDestroyed) {
      return false;
    }

    log?.(`Sending handshake ${message.type}`, message);

    try {
      messenger.sendMessage(message);
      return true;
    } catch (error) {
      rejectAndCleanUp(
        new PenpalError('TRANSMISSION_FAILED', (error as Error).message),
      );
      return false;
    }
  };

  const sendSynMessage = () => {
    const synMessage: SynMessage = {
      namespace,
      type: 'SYN',
      channel,
      participantId: participantId,
    };

    return sendHandshakeMessage(synMessage);
  };

  const handleSynMessage = (message: SynMessage) => {
    log?.(`Received handshake SYN`, message);

    if (message.participantId === remoteParticipantId) {
      return;
    }

    remoteParticipantId = message.participantId;

    // We send another SYN message in case the other participant was not ready
    // when we sent the first SYN message.
    if (!sendSynMessage()) {
      return;
    }

    const isHandshakeLeader = participantId > remoteParticipantId;

    if (!isHandshakeLeader) {
      return;
    }

    const ack1Message: Ack1Message = {
      namespace,
      channel,
      type: 'ACK1',
    };

    if (!sendHandshakeMessage(ack1Message)) {
      return;
    }
  };

  const handleAck1Message = (message: Ack1Message) => {
    log?.(`Received handshake ACK1`, message);
    const ack2Message: Ack2Message = {
      namespace,
      channel,
      type: 'ACK2',
    };

    if (sendHandshakeMessage(ack2Message)) {
      completeHandshake();
    }
  };

  const handleAck2Message = (message: Ack2Message) => {
    log?.(`Received handshake ACK2`, message);
    completeHandshake();
  };

  const handleMessage = (message: Message) => {
    if (isDestroyed) {
      return;
    }

    if (isSynMessage(message)) {
      handleSynMessage(message);
    } else if (isAck1Message(message)) {
      handleAck1Message(message);
    } else if (isAck2Message(message)) {
      handleAck2Message(message);
    }
  };

  messenger.addMessageHandler(handleMessage);
  destroyHandlers.push(() => messenger.removeMessageHandler(handleMessage));

  sendSynMessage();

  return {
    promise,
    destroy,
  };
};

export default shakeHands;
