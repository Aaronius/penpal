import { MethodPath, Envelope, ReplyMessage, SerializedError } from './types';
import namespace from './namespace';
import { MessageType } from './enums';
import { serializeError } from './errorSerialization';
import { isCallMessage, isReplyMessage, isAck1Message } from './guards';
import PenpalBugError from './PenpalBugError';

export const DEPRECATED_PENPAL_PARTICIPANT_ID = 'deprecated-penpal';

// TODO: This file is used for backward-compatibility. Remove in next major version.

enum DeprecatedMessageType {
  Call = 'call',
  Reply = 'reply',
  Syn = 'syn',
  SynAck = 'synAck',
  Ack = 'ack',
}

enum DeprecatedResolution {
  Fulfilled = 'fulfilled',
  Rejected = 'rejected',
}

type DeprecatedSynMessage = {
  penpal: DeprecatedMessageType.Syn;
};

type DeprecatedSynAckMessage = {
  penpal: DeprecatedMessageType.SynAck;
  methodNames: string[];
};

type DeprecatedAckMessage = {
  penpal: DeprecatedMessageType.Ack;
  methodNames: string[];
};

type DeprecatedCallMessage = {
  penpal: DeprecatedMessageType.Call;
  id: number;
  methodName: string;
  args: unknown[];
};

type DeprecatedSerializedError = {
  name: string;
  message: string;
  stack?: string;
};

type DeprecatedReplyMessage = {
  penpal: DeprecatedMessageType.Reply;
  id: number;
} & (
  | {
      resolution: DeprecatedResolution;
      returnValue: unknown;
      returnValueIsError?: false;
    }
  | {
      resolution: DeprecatedResolution.Rejected;
      returnValue: DeprecatedSerializedError;
      returnValueIsError: true;
    }
);

export type DeprecatedMessage =
  | DeprecatedSynMessage
  | DeprecatedSynAckMessage
  | DeprecatedAckMessage
  | DeprecatedCallMessage
  | DeprecatedReplyMessage;

export const isDeprecatedMessage = (
  data: unknown
): data is DeprecatedMessage => {
  return !!data && typeof data === 'object' && 'penpal' in data;
};

const upgradeMethodPath = (methodPath: string): MethodPath =>
  methodPath.split('.');
const downgradeMethodPath = (methodPath: MethodPath) => methodPath.join('.');

export const upgradeMessage = (message: DeprecatedMessage): Envelope => {
  if (message.penpal === DeprecatedMessageType.Syn) {
    return {
      namespace,
      message: {
        type: MessageType.Syn,
        participantId: DEPRECATED_PENPAL_PARTICIPANT_ID,
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Ack) {
    return {
      namespace,
      message: {
        type: MessageType.Ack2,
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Call) {
    return {
      namespace,
      message: {
        type: MessageType.Call,
        // Actually converting the ID to a string would break communication.
        id: (message.id as unknown) as string,
        methodPath: upgradeMethodPath(message.methodName),
        args: message.args,
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Reply) {
    let upgradedMessage: ReplyMessage;

    if (message.resolution === DeprecatedResolution.Fulfilled) {
      upgradedMessage = {
        type: MessageType.Reply,
        // Actually converting the ID to a string would break communication.
        callId: (message.id as unknown) as string,
        value: message.returnValue,
      };
    } else {
      let error: SerializedError;

      if (message.returnValueIsError) {
        error = message.returnValue;
      } else {
        error = serializeError(
          new Error(
            message.returnValue === undefined
              ? undefined
              : String(message.returnValue)
          )
        );
      }

      upgradedMessage = {
        type: MessageType.Reply,
        // Actually converting the ID to a string would break communication.
        callId: (message.id as unknown) as string,
        value: error,
        isError: true,
      };
    }

    return {
      namespace,
      message: upgradedMessage,
    };
  }

  throw new PenpalBugError(
    `Unexpected message to upgrade: ${JSON.stringify(message)}`
  );
};

export const downgradeEnvelope = (envelope: Envelope): DeprecatedMessage => {
  const { message } = envelope;

  if (isAck1Message(message)) {
    return {
      penpal: DeprecatedMessageType.SynAck,
      methodNames: message.methodPaths.map(downgradeMethodPath),
    };
  }

  if (isCallMessage(message)) {
    return {
      penpal: DeprecatedMessageType.Call,
      // Actually converting the ID to a number would break communication.
      id: (message.id as unknown) as number,
      methodName: downgradeMethodPath(message.methodPath),
      args: message.args,
    };
  }

  if (isReplyMessage(message)) {
    if (message.isError) {
      return {
        penpal: DeprecatedMessageType.Reply,
        // Actually converting the ID to a number would break communication.
        id: (message.callId as unknown) as number,
        resolution: DeprecatedResolution.Rejected,
        returnValue: message.value,
        returnValueIsError: true,
      };
    } else {
      return {
        penpal: DeprecatedMessageType.Reply,
        // Actually converting the ID to a number would break communication.
        id: (message.callId as unknown) as number,
        resolution: DeprecatedResolution.Fulfilled,
        returnValue: message.value,
      };
    }
  }

  throw new PenpalBugError(
    `Unexpected message to downgrade: ${JSON.stringify(message)}`
  );
};
