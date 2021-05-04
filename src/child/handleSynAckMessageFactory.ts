import { AckMessage, CallSender, Methods, WindowsInfo } from '../types';
import { MessageType } from '../enums';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import { Destructor } from '../createDestructor';

/**
 * Handles a SYN-ACK handshake message.
 */
export default (
  parentOrigin: string | RegExp,
  methods: Methods,
  destructor: Destructor,
  log: Function
) => {
  const { destroy, onDestroy } = destructor;

  return (event: MessageEvent): CallSender | undefined => {
    let originQualifies =
      parentOrigin instanceof RegExp
        ? parentOrigin.test(event.origin)
        : parentOrigin === '*' || parentOrigin === event.origin;

    if (!originQualifies) {
      log(
        `Child: Handshake - Received SYN-ACK from origin ${event.origin} which did not match expected origin ${parentOrigin}`
      );
      return;
    }

    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    // If event.origin is "null", the remote protocol is file: or data: and we
    // must post messages with "*" as targetOrigin when sending messages.
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#Using_window.postMessage_in_extensions
    const originForSending = event.origin === 'null' ? '*' : event.origin;

    const ackMessage: AckMessage = {
      penpal: MessageType.Ack,
      methodNames: Object.keys(methods),
    };

    window.parent.postMessage(ackMessage, originForSending);

    const info: WindowsInfo = {
      localName: 'Child',
      local: window,
      remote: window.parent,
      originForSending,
      originForReceiving: event.origin,
    };

    const destroyCallReceiver = connectCallReceiver(info, methods, log);
    onDestroy(destroyCallReceiver);

    const callSender: CallSender = {};
    const destroyCallSender = connectCallSender(
      callSender,
      info,
      event.data.methodNames,
      destroy,
      log
    );
    onDestroy(destroyCallSender);

    return callSender;
  };
};
