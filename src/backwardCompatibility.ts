import { Message, MethodPath } from './types.js';
import namespace from './namespace.js';
import {
  isCallMessage,
  isReplyMessage,
  isAck1Message,
  isObject,
} from './guards.js';
import PenpalBugError from './PenpalBugError.js';

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
      resolution: DeprecatedResolution.Fulfilled;
      returnValue: unknown;
      returnValueIsError?: false;
    }
  | {
      resolution: DeprecatedResolution.Rejected;
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
  return isObject(data) && 'penpal' in data;
};

const upgradeMethodPath = (methodPath: string): MethodPath =>
  methodPath.split('.');
const downgradeMethodPath = (methodPath: MethodPath) => methodPath.join('.');

const getUnexpectedMessageError = (message: unknown) => {
  return new PenpalBugError(
    `Unexpected message to translate: ${JSON.stringify(message)}`
  );
};

export const upgradeMessage = (message: DeprecatedMessage): Message => {
  if (message.penpal === DeprecatedMessageType.Syn) {
    return {
      namespace,
      channel: undefined,
      type: 'SYN',
      participantId: DEPRECATED_PENPAL_PARTICIPANT_ID,
    };
  }

  if (message.penpal === DeprecatedMessageType.Ack) {
    return {
      namespace,
      channel: undefined,
      type: 'ACK2',
    };
  }

  if (message.penpal === DeprecatedMessageType.Call) {
    return {
      namespace,
      channel: undefined,
      type: 'CALL',
      // Actually converting the ID to a string would break communication.
      id: (message.id as unknown) as string,
      methodPath: upgradeMethodPath(message.methodName),
      args: message.args,
    };
  }

  if (message.penpal === DeprecatedMessageType.Reply) {
    if (message.resolution === DeprecatedResolution.Fulfilled) {
      return {
        namespace,
        channel: undefined,
        type: 'REPLY',
        // Actually converting the ID to a string would break communication.
        callId: (message.id as unknown) as string,
        value: message.returnValue,
      };
    } else {
      return {
        namespace,
        channel: undefined,
        type: 'REPLY',
        // Actually converting the ID to a string would break communication.
        callId: (message.id as unknown) as string,
        isError: true,
        ...(message.returnValueIsError
          ? {
              value: message.returnValue,
              isSerializedErrorInstance: true,
            }
          : {
              value: message.returnValue,
            }),
      };
    }
  }

  throw getUnexpectedMessageError(message);
};

export const downgradeMessage = (message: Message): DeprecatedMessage => {
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
        ...(message.isSerializedErrorInstance
          ? {
              returnValue: message.value,
              returnValueIsError: true,
            }
          : { returnValue: message.value }),
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

  throw getUnexpectedMessageError(message);
};
