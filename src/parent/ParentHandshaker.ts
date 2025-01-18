import {
  AckMessage,
  FlattenedMethods,
  Log,
  Methods,
  PenpalMessage,
  RemoteMethodProxies,
  SynAckMessage,
} from '../types';
import Messenger from '../Messenger';
import { ErrorCode, MessageType } from '../enums';
import PenpalError from '../PenpalError';
import connectCallHandler from '../connectCallHandler';
import connectRemoteMethodProxies from '../connectRemoteMethodProxies';

class ParentHandshaker<TMethods extends Methods> {
  private _closeCallHandler?: () => void;
  private _closeRemoteMethodProxies?: () => void;
  private _remoteMethodProxies: RemoteMethodProxies<TMethods>;

  constructor(
    private _messenger: Messenger,
    private _flattenedMethods: FlattenedMethods,
    private _closeConnection: (error: PenpalError) => void,
    private _onRemoteMethodProxiesConnected: (
      remoteMethodProxies: RemoteMethodProxies<TMethods>
    ) => void,
    private _log: Log
  ) {
    this._remoteMethodProxies = {} as RemoteMethodProxies<TMethods>;
    this._messenger.addMessageHandler(this._handleMessage);
  }

  private _handleMessage = (message: PenpalMessage) => {
    if (message.type === MessageType.Syn) {
      this._handleSynMessage();
    }

    if (message.type === MessageType.Ack) {
      this._handleAckMessage(message);
    }
  };

  private _handleSynMessage = () => {
    this._log('Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      type: MessageType.SynAck,
      methodPaths: Object.keys(this._flattenedMethods),
    };

    try {
      this._messenger.sendMessage(synAckMessage);
    } catch (error) {
      this._closeConnection(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
    }
  };

  private _handleAckMessage = (message: AckMessage) => {
    this._log('Handshake - Received ACK');

    // this._closeCallHandler will be defined if the child is reconnecting.
    if (this._closeCallHandler) {
      this._closeCallHandler();
    }

    // this._closeRemoteMethodProxies will be defined if the child is reconnecting.
    if (this._closeRemoteMethodProxies) {
      this._closeRemoteMethodProxies();
    }

    this._closeCallHandler = connectCallHandler(
      this._messenger,
      this._flattenedMethods,
      this._log
    );

    // If the child reconnects (for example, after refreshing or navigating
    // to another page that uses Penpal, we'll update the
    // remoteMethodProxiesObject with methods that match the latest
    // provided by the child.
    for (const key of Object.keys(this._remoteMethodProxies)) {
      delete this._remoteMethodProxies[key];
    }

    this._closeRemoteMethodProxies = connectRemoteMethodProxies(
      this._remoteMethodProxies,
      this._messenger,
      message.methodPaths,
      this._log
    );

    // This method may be called multiple times if the child reconnects.
    this._onRemoteMethodProxiesConnected(this._remoteMethodProxies);
  };

  close = () => {
    this._messenger.removeMessageHandler(this._handleMessage);
    this._closeCallHandler?.();
    this._closeRemoteMethodProxies?.();
  };
}

export default ParentHandshaker;
