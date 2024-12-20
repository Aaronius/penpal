import { Log, PenpalMessage, Destructor } from '../types';
import Messenger from '../Messenger';
import namespace from '../namespace';

class ParentToWorkerMessenger implements Messenger {
  private _worker: Worker;
  private _log: Log;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();

  constructor(worker: Worker, log: Log, destructor: Destructor) {
    this._worker = worker;
    this._log = log;

    worker.addEventListener('message', this._handleMessageFromChild);

    destructor.onDestroy(() => {
      worker.removeEventListener('message', this._handleMessageFromChild);
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromChild = (event: MessageEvent): void => {
    if (event.data?.namespace !== namespace) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  sendMessage = (
    message: PenpalMessage,
    transferables?: Transferable[]
  ): void => {
    this._worker.postMessage(message, {
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

export default ParentToWorkerMessenger;
