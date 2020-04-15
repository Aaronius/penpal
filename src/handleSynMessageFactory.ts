import { Methods, SynAckMessage } from './types';
import { MessageType } from './enums';

export default (log: Function, methods: Methods, originForSending: string) => {
  return (event: MessageEvent) => {
    log('Parent: Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      penpal: MessageType.SynAck,
      methodNames: Object.keys(methods)
    };

    (event.source as Window).postMessage(synAckMessage, originForSending);
  };
};
