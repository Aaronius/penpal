export { default as connect } from './connect.js';
export { default as WindowMessenger } from './messengers/WindowMessenger.js';
export { default as WorkerMessenger } from './messengers/WorkerMessenger.js';
export { default as PortMessenger } from './messengers/PortMessenger.js';
export { default as CallOptions } from './CallOptions.js';
export { default as Reply } from './Reply.js';
export { default as PenpalError } from './PenpalError.js';
export { default as ErrorCode } from './ErrorCodeObj.js';
export { default as debug } from './debug.js';
export type { Connection, RemoteProxy, Methods } from './types.js';

// For building custom messengers
export type { default as Messenger } from './messengers/Messenger.js';
export type {
  InitializeMessengerOptions,
  MessageHandler,
} from './messengers/Messenger.js';
export type {
  Log,
  Message,
  SynMessage,
  Ack1Message,
  Ack2Message,
  CallMessage,
  ReplyMessage,
  DestroyMessage,
} from './types.js';
