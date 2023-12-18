import { PenpalMessage } from './types';

interface CommsAdapter {
  sendMessageToRemote: (message: PenpalMessage) => void;
  listenForMessagesFromRemote: (
    callback: (message: PenpalMessage) => void
  ) => void;
  stopListeningForMessagesFromRemote: (
    callback: (message: PenpalMessage) => void
  ) => void;
}

export default CommsAdapter;
