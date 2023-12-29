import { PenpalMessage } from '../types';
import { Destructor } from '../createDestructor';
import CommsAdapter from '../CommsAdapter';

class ParentToWorkerAdapter implements CommsAdapter {
  private _worker: Worker;
  private _log: Function;
  private _messageCallbacks: Set<(message: PenpalMessage) => void> = new Set();

  constructor(worker: Worker, log: Function, destructor: Destructor) {
    this._worker = worker;
    this._log = log;

    worker.addEventListener('message', this._handleMessageFromChild);

    destructor.onDestroy(() => {
      worker.removeEventListener('message', this._handleMessageFromChild);
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromChild = (event: MessageEvent): void => {
    if (!event.data?.penpal) {
      return;
    }

    const penpalMessage: PenpalMessage = event.data;
    const { penpal: messageType } = penpalMessage;

    for (const callback of this._messageCallbacks) {
      callback(penpalMessage);
    }
  };

  sendMessage = (message: PenpalMessage): void => {
    this._worker.postMessage(message);
  };

  addMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.delete(callback);
  };
}

export default ParentToWorkerAdapter;
