import { PenpalMessage } from './types';

export type MessageHandler = (message: PenpalMessage) => void;

interface Messenger {
  sendMessage: (message: PenpalMessage, transferables?: Transferable[]) => void;
  addMessageHandler: (callback: MessageHandler) => void;
  removeMessageHandler: (callback: MessageHandler) => void;
  close: () => void;
}

export default Messenger;
