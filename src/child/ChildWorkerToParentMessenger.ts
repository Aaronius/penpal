import { Log, PenpalMessage, PenpalMessageEnvelope } from '../types';
import Messenger, { InitializeOptions } from '../Messenger';
import namespace from '../namespace';
import { isAckMessage, isPenpalMessageEnvelope, isSynMessage } from '../guards';

type Options = {
  channel?: string;
};

class ChildWindowToParentMessenger implements Messenger {
  private _channel?: string;
  private _messageCallbacks = new Set<(message: PenpalMessage) => void>();
  private _port1: MessagePort;
  private _port2: MessagePort;
  private _log?: Log;

  constructor({ channel }: Options = {}) {
    this._channel = channel;

    self.addEventListener('message', this._handleMessage);

    const { port1, port2 } = new MessageChannel();
    this._port1 = port1;
    this._port2 = port2;
    port1.addEventListener('message', this._handleMessage);
    port1.start();
  }

  private _handleMessage = (event: MessageEvent): void => {
    if (!isPenpalMessageEnvelope(event.data)) {
      return;
    }

    const { channel, message } = event.data;

    if (channel !== this._channel) {
      return;
    }

    for (const callback of this._messageCallbacks) {
      callback(message);
    }
  };

  sendMessage = (message: PenpalMessage, transferables?: Transferable[]) => {
    const envelope: PenpalMessageEnvelope = {
      namespace,
      channel: this._channel,
      message,
    };

    if (isSynMessage(message)) {
      self.postMessage(envelope, { transfer: transferables });
      return;
    }

    if (isAckMessage(message)) {
      self.postMessage(envelope, {
        transfer: [this._port2, ...(transferables || [])],
      });
      return;
    }

    this._port1.postMessage(envelope, { transfer: transferables });
  };

  addMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.add(callback);
  };

  removeMessageHandler = (callback: (message: PenpalMessage) => void): void => {
    this._messageCallbacks.delete(callback);
  };

  initialize = ({ log }: InitializeOptions) => {
    this._log = log;
  };

  close = () => {
    self.removeEventListener('message', this._handleMessage);
    this._port1.removeEventListener('message', this._handleMessage);
    this._port1.close();
    this._messageCallbacks.clear();
  };
}

export default ChildWindowToParentMessenger;
