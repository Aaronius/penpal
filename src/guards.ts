import namespace from './namespace';
import {
  AckMessage,
  CallMessage,
  Message,
  Envelope,
  ReplyMessage,
  SynAckMessage,
  SynMessage,
} from './types';
import { MessageType } from './enums';

export const isEnvelope = (value: unknown): value is Envelope => {
  return (
    typeof value === 'object' &&
    value !== null &&
    // @ts-expect-error namespace isn't a known property
    value.namespace === namespace
  );
};

export const isSynMessage = (message: Message): message is SynMessage => {
  return message.type === MessageType.Syn;
};

export const isSynAckMessage = (message: Message): message is SynAckMessage => {
  return message.type === MessageType.SynAck;
};

export const isAckMessage = (message: Message): message is AckMessage => {
  return message.type === MessageType.Ack;
};

export const isCallMessage = (message: Message): message is CallMessage => {
  return message.type === MessageType.Call;
};

export const isReplyMessage = (message: Message): message is ReplyMessage => {
  return message.type === MessageType.Reply;
};
