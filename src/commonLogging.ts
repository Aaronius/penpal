import { Log, PenpalMessageEnvelope } from './types';

export const logSendingMessage = (
  { channel, message }: PenpalMessageEnvelope,
  log?: Log
) => {
  const preamble = 'Sending message';
  log?.(channel ? `${preamble} on channel ${channel}` : preamble, message);
};

export const logReceivedMessage = (
  { channel, message }: PenpalMessageEnvelope,
  log?: Log
) => {
  const preamble = 'Received message';
  log?.(channel ? `${preamble} on channel ${channel}` : preamble, message);
};
