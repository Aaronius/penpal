import namespace from './namespace.js';
import {
  Ack2Message,
  CallMessage,
  Message,
  ReplyMessage,
  Ack1Message,
  SynMessage,
  DestroyMessage,
} from './types.js';

export const isObject = (
  value: unknown
): value is Record<string | number | symbol, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const isFunction = (value: unknown) => {
  return typeof value === 'function';
};

export const isMessage = (data: unknown): data is Message => {
  return isObject(data) && data.namespace === namespace;
};

export const isSynMessage = (message: Message): message is SynMessage => {
  return message.type === 'SYN';
};

export const isAck1Message = (message: Message): message is Ack1Message => {
  return message.type === 'ACK1';
};

export const isAck2Message = (message: Message): message is Ack2Message => {
  return message.type === 'ACK2';
};

export const isCallMessage = (message: Message): message is CallMessage => {
  return message.type === 'CALL';
};

export const isReplyMessage = (message: Message): message is ReplyMessage => {
  return message.type === 'REPLY';
};

export const isDestroyMessage = (
  message: Message
): message is DestroyMessage => {
  return message.type === 'DESTROY';
};
