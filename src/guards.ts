import namespace from './namespace';
import {
  Ack2Message,
  CallMessage,
  Message,
  Envelope,
  ReplyMessage,
  Ack1Message,
  SynMessage,
  CloseMessage,
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

export const isAck1Message = (message: Message): message is Ack1Message => {
  return message.type === MessageType.Ack1;
};

export const isAck2Message = (message: Message): message is Ack2Message => {
  return message.type === MessageType.Ack2;
};

export const isCallMessage = (message: Message): message is CallMessage => {
  return message.type === MessageType.Call;
};

export const isReplyMessage = (message: Message): message is ReplyMessage => {
  return message.type === MessageType.Reply;
};

export const isCloseMessage = (message: Message): message is CloseMessage => {
  return message.type === MessageType.Close;
};
