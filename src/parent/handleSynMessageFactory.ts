import { SerializedMethods, SynAckMessage } from '../types';
import { MessageType } from '../enums';

/**
 * Handles a SYN handshake message.
 */
export default (
  log: Function,
  serializedMethods: SerializedMethods,
  childOrigin: string,
  originForSending: string
) => {
  return (event: MessageEvent) => {
    // Under specific timing circumstances, we can receive an event
    // whose source is null. This seems to happen when the child iframe is
    // removed from the DOM about the same time it has sent the SYN event.
    // https://github.com/Aaronius/penpal/issues/85
    if (!event.source) {
      return;
    }

    if (childOrigin !== '*' && event.origin !== childOrigin) {
      log(
        `Parent: Handshake - Received SYN message from origin ${event.origin} which did not match expected origin ${childOrigin}`
      );
      return;
    }

    log('Parent: Handshake - Received SYN, responding with SYN-ACK');

    const synAckMessage: SynAckMessage = {
      penpal: MessageType.SynAck,
      methodNames: Object.keys(serializedMethods),
    };

    (event.source as Window).postMessage(synAckMessage, originForSending);
  };
};
