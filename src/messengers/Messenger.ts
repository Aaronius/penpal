import { Message, Log } from '../types.js';

export type MessageHandler = (message: Message) => void;

export type InitializeMessengerOptions = {
  log?: Log;
  validateReceivedMessage: (data: unknown) => data is Message;
};

interface Messenger {
  sendMessage: (message: Message, transferables?: Transferable[]) => void;
  addMessageHandler: (callback: MessageHandler) => void;
  removeMessageHandler: (callback: MessageHandler) => void;
  initialize: (options: InitializeMessengerOptions) => void;
  destroy: () => void;
}

export default Messenger;
