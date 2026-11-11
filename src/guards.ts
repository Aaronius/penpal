import namespace from './namespace.js';
import type { Ack2Message, Message, Ack1Message, SynMessage } from './types.js';

export const isObject = (
  value: unknown,
): value is Record<string | number | symbol, unknown> => {
  return typeof value === 'object' && value !== null;
};

export const isFunction = (value: unknown): value is Function => {
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
