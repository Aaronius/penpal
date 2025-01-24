import { PenpalMessageEnvelope, ReplyMessage } from './types';
import namespace from './namespace';
import { MessageType } from './enums';

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

type DeprecatedReplyMessage = {
  penpal: DeprecatedMessageType.Reply;
  id: number;
  resolution: DeprecatedResolution;
  returnValue: unknown;
  returnValueIsError?: boolean;
};

export type DeprecatedPenpalMessage =
  | DeprecatedSynMessage
  | DeprecatedSynAckMessage
  | DeprecatedAckMessage
  | DeprecatedCallMessage
  | DeprecatedReplyMessage;

export const isDeprecatedMessage = (
  data: unknown
): data is DeprecatedPenpalMessage => {
  return !!data && typeof data === 'object' && 'penpal' in data;
};

export const upgradeMessage = (
  message: DeprecatedPenpalMessage
): PenpalMessageEnvelope => {
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
        methodPaths: message.methodNames,
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Ack) {
    return {
      namespace,
      message: {
        type: MessageType.Ack,
        methodPaths: message.methodNames,
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Call) {
    return {
      namespace,
      message: {
        type: MessageType.Call,
        sessionId: message.id,
        methodPath: message.methodName,
        args: message.args,
      },
    };
  }

  if (message.penpal === DeprecatedMessageType.Reply) {
    let upgradedMessage: ReplyMessage;

    if (message.resolution === DeprecatedResolution.Fulfilled) {
      upgradedMessage = {
        type: MessageType.Reply,
        sessionId: message.id,
        value: message.returnValue,
      };
    } else {
      upgradedMessage = {
        type: MessageType.Reply,
        sessionId: message.id,
        isError: true,
        error: message.returnValue,
        isSerializedErrorInstance: !!message.returnValueIsError,
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

export const downgradeMessageEnvelope = (
  messageEnvelope: PenpalMessageEnvelope
): DeprecatedPenpalMessage => {
  const { message } = messageEnvelope;

  if (message.type === MessageType.Syn) {
    return {
      penpal: DeprecatedMessageType.Syn,
    };
  }

  if (message.type === MessageType.SynAck) {
    return {
      penpal: DeprecatedMessageType.SynAck,
      methodNames: message.methodPaths,
    };
  }

  if (message.type === MessageType.Ack) {
    return {
      penpal: DeprecatedMessageType.Ack,
      methodNames: message.methodPaths,
    };
  }

  if (message.type === MessageType.Call) {
    return {
      penpal: DeprecatedMessageType.Call,
      id: message.sessionId,
      methodName: message.methodPath,
      args: message.args,
    };
  }

  if (message.type === MessageType.Reply) {
    return {
      penpal: DeprecatedMessageType.Reply,
      id: message.sessionId,
      resolution: message.isError
        ? DeprecatedResolution.Rejected
        : DeprecatedResolution.Fulfilled,
      returnValue: message.isError ? message.error : message.value,
      returnValueIsError: message.isError && message.isSerializedErrorInstance,
    };
  }

  throw new Error(
    // @ts-expect-error This should never happen.
    `Unrecognized message type ${message.type} on message`,
    message
  );
};
