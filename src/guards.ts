import namespace from './namespace';
import {
  AckMessage,
  CallMessage,
  PenpalMessage,
  PenpalMessageEnvelope,
  ReplyMessage,
  SynAckMessage,
  SynMessage,
} from './types';
import { MessageType } from './enums';

export const isPenpalMessageEnvelope = (
  eventData: unknown
): eventData is PenpalMessageEnvelope => {
  return (
    typeof eventData === 'object' &&
    eventData !== null &&
    // @ts-expect-error namespace isn't a known property
    eventData.namespace === namespace
  );
};

export const isSynMessage = (message: PenpalMessage): message is SynMessage => {
  return message.type === MessageType.Syn;
};

export const isSynAckMessage = (
  message: PenpalMessage
): message is SynAckMessage => {
  return message.type === MessageType.SynAck;
};

export const isAckMessage = (message: PenpalMessage): message is AckMessage => {
  return message.type === MessageType.Ack;
};

export const isCallMessage = (
  message: PenpalMessage
): message is CallMessage => {
  return message.type === MessageType.Call;
};

export const isReplyMessage = (
  message: PenpalMessage
): message is ReplyMessage => {
  return message.type === MessageType.Reply;
};
