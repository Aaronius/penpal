import {
  Log,
  PenpalMessage,
  Destructor,
  PenpalMessageEnvelope,
} from '../types';
import Messenger from '../Messenger';
import namespace from '../namespace';

class WorkerToParentMessenger implements Messenger {
  private _channel?: string;
  private _log: Log;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _originForSending?: string;

  constructor(channel: string | undefined, log: Log, destructor: Destructor) {
    this._channel = channel;
    this._log = log;

    self.addEventListener('message', this._handleMessageFromParent);

    destructor.onDestroy(() => {
      self.removeEventListener('message', this._handleMessageFromParent);
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromParent = (event: MessageEvent): void => {
    if (
      event.data?.namespace !== namespace ||
      event.data?.channel !== this._channel
    ) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data.message;

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  sendMessage = (message: PenpalMessage, transferables?: Transferable[]) => {
    const envelope: PenpalMessageEnvelope = {
      namespace,
      channel: this._channel,
      message,
    };

    self.postMessage(envelope, {
      targetOrigin: this._originForSending,
      transfer: transferables,
    });
  };

  addMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.delete(callback);
  };
}

export default WorkerToParentMessenger;
