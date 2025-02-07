import { Message, Log } from '../types';

export type MessageHandler = (message: Message) => void;

export type InitializeOptions = {
  log?: Log;
  validateReceivedMessage: (data: unknown) => data is Message;
};

interface Messenger {
  sendMessage: (message: Message, transferables?: Transferable[]) => void;
  addMessageHandler: (callback: MessageHandler) => void;
  removeMessageHandler: (callback: MessageHandler) => void;
  initialize: (options: InitializeOptions) => void;
  close: () => void;
}

export default Messenger;
