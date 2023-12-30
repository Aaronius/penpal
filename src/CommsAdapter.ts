import { PenpalMessage } from './types';

interface CommsAdapter {
  sendMessage: (message: PenpalMessage, transferables?: Transferable[]) => void;
  addMessageHandler: (callback: (message: PenpalMessage) => void) => void;
  removeMessageHandler: (callback: (message: PenpalMessage) => void) => void;
}

export default CommsAdapter;
