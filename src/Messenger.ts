import { PenpalMessage, Log } from './types';

export type MessageHandler = (message: PenpalMessage) => void;

export type InitializeOptions = {
  log?: Log;
};

interface Messenger {
  sendMessage: (message: PenpalMessage, transferables?: Transferable[]) => void;
  addMessageHandler: (callback: MessageHandler) => void;
  removeMessageHandler: (callback: MessageHandler) => void;
  initialize: (options: InitializeOptions) => void;
  close: () => void;
}

export default Messenger;
