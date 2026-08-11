import type { Message, Log } from '../types.js';

export type MessageHandler = (message: Message) => void;

export type InitializeMessengerOptions = {
  log?: Log | undefined;
  validateReceivedMessage: (data: unknown) => data is Message;
};

export default interface Messenger {
  sendMessage: (message: Message, transferables?: Transferable[]) => void;
  addMessageHandler: (callback: MessageHandler) => void;
  removeMessageHandler: (callback: MessageHandler) => void;
  initialize: (options: InitializeMessengerOptions) => void;
  destroy: () => void;
}
