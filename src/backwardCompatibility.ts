import { MethodPath, Envelope, ReplyMessage, SerializedError } from './types';
import namespace from './namespace';
import { MessageType } from './enums';
import { serializeError } from './errorSerialization';
import {
  isAckMessage,
  isCallMessage,
  isReplyMessage,
  isSynAckMessage,
} from './guards';

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
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.SynAck) {
    return {
      namespace,
      message: {
        type: MessageType.SynAck,
        methodPaths: message.methodNames.map(upgradeMethodPath),
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Ack) {
    return {
      namespace,
      message: {
        type: MessageType.Ack,
        methodPaths: message.methodNames.map(upgradeMethodPath),
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Call) {
    return {
      namespace,
      message: {
        type: MessageType.Call,
        id: message.id,
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
        callId: message.id,
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
        callId: message.id,
        value: error,
        isError: true,
      };
    }

    return {
      namespace,
      message: upgradedMessage,
    };
  }

  throw new Error(
    // @ts-expect-error This should never happen.
    `Unrecognized message type ${message.penpal} on message`,
    message
  );
};

export const downgradeEnvelope = (envelope: Envelope): DeprecatedMessage => {
  const { message } = envelope;

  if (message.type === MessageType.Syn) {
    return {
      penpal: DeprecatedMessageType.Syn,
    };
  }

  if (isSynAckMessage(message)) {
    return {
      penpal: DeprecatedMessageType.SynAck,
      methodNames: message.methodPaths.map(downgradeMethodPath),
    };
  }

  if (isAckMessage(message)) {
    return {
      penpal: DeprecatedMessageType.Ack,
      methodNames: message.methodPaths.map(downgradeMethodPath),
    };
  }

  if (isCallMessage(message)) {
    return {
      penpal: DeprecatedMessageType.Call,
      id: message.id,
      methodName: downgradeMethodPath(message.methodPath),
      args: message.args,
    };
  }

  if (isReplyMessage(message)) {
    if (message.isError) {
      return {
        penpal: DeprecatedMessageType.Reply,
        id: message.callId,
        resolution: DeprecatedResolution.Rejected,
        returnValue: message.value,
        returnValueIsError: true,
      };
    } else {
      return {
        penpal: DeprecatedMessageType.Reply,
        id: message.callId,
        resolution: DeprecatedResolution.Fulfilled,
        returnValue: message.value,
      };
    }
  }

  throw new Error(
    // @ts-expect-error This should never happen.
    `Unrecognized message type ${message.type} on message`,
    message
  );
};
