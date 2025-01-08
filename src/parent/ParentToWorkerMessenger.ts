import {
  Log,
  PenpalMessage,
  Destructor,
  PenpalMessageEnvelope,
} from '../types';
import Messenger from '../Messenger';
import namespace from '../namespace';

class ParentToWorkerMessenger implements Messenger {
  private _worker: Worker;
  private _channel?: string;
  private _log: Log;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();

  constructor(
    worker: Worker,
    channel: string | undefined,
    log: Log,
    destructor: Destructor
  ) {
    this._worker = worker;
    this._channel = channel;
    this._log = log;

    worker.addEventListener('message', this._handleMessageFromChild);

    destructor.onDestroy(() => {
      worker.removeEventListener('message', this._handleMessageFromChild);
      this._messageCallbacks.clear();
    });
  }

  private _handleMessageFromChild = (event: MessageEvent): void => {
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

  sendMessage = (
    message: PenpalMessage,
    transferables?: Transferable[]
  ): void => {
    const envelope: PenpalMessageEnvelope = {
      namespace,
      channel: this._channel,
      message,
    };

    this._worker.postMessage(envelope, {
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
