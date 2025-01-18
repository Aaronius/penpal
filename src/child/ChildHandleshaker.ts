import Messenger from '../Messenger';
import {
  AckMessage,
  FlattenedMethods,
  Log,
  Methods,
  PenpalMessage,
  RemoteMethodProxies,
  SynAckMessage,
  SynMessage,
} from '../types';
import { ErrorCode, MessageType } from '../enums';
import PenpalError from '../PenpalError';
import connectCallHandler from '../connectCallHandler';
import connectRemoteMethodProxies from '../connectRemoteMethodProxies';

class ChildHandleshaker<TMethods extends Methods> {
  private _closeCallHandler?: () => void;
  private _closeRemoteMethodProxies?: () => void;

  constructor(
    private _messenger: Messenger,
    private _flattenedMethods: FlattenedMethods,
    private _closeConnection: (error: PenpalError) => void,
    private _onRemoteMethodProxiesCreated: (
      remoteMethodProxies: RemoteMethodProxies<TMethods>
    ) => void,
    private _log: Log
  ) {
    this._messenger.addMessageHandler(this._handleMessage);
  }

  private _handleMessage = (message: PenpalMessage) => {
    if (message.type === MessageType.SynAck) {
      this._handleSynAckMessage(message);
    }
  };

  private _handleSynAckMessage = (message: SynAckMessage) => {
    // We should only receive a single SynAck message from the parent,
    // so we can stop listening for more.
    this._messenger.removeMessageHandler(this._handleMessage);
    this._log('Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      type: MessageType.Ack,
      methodPaths: Object.keys(this._flattenedMethods),
    };

    try {
      this._messenger.sendMessage(ackMessage);
    } catch (error) {
      this._closeConnection(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
      return;
    }

    this._closeCallHandler = connectCallHandler(
      this._messenger,
      this._flattenedMethods,
      this._log
    );

    const remoteMethodProxies = {} as RemoteMethodProxies<TMethods>;

    this._closeRemoteMethodProxies = connectRemoteMethodProxies(
      remoteMethodProxies,
      this._messenger,
      message.methodPaths,
      this._log
    );

    this._onRemoteMethodProxiesCreated(remoteMethodProxies);
  };

  shake = () => {
    this._log('Handshake - Sending SYN');
    const synMessage: SynMessage = {
      type: MessageType.Syn,
    };

    try {
      this._messenger.sendMessage(synMessage);
    } catch (error) {
      this._closeConnection(
        new PenpalError(ErrorCode.TransmissionFailed, (error as Error).message)
      );
    }
  };

  close = () => {
    this._messenger.removeMessageHandler(this._handleMessage);
    this._closeCallHandler?.();
    this._closeRemoteMethodProxies?.();
  };
}

export default ChildHandleshaker;
