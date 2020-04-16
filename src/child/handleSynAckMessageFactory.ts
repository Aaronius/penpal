import { AckMessage, CallSender, Methods, WindowsInfo } from '../types';
import { MessageType } from '../enums';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';
import { Destructor } from '../createDestructor';

/**
 * Handles a SYN-ACK handshake message.
 */
export default (
  parentOrigin: string,
  methods: Methods,
  destructor: Destructor,
  log: Function
) => {
  const { destroy, onDestroy } = destructor;

  return (event: MessageEvent): CallSender | undefined => {
    if (parentOrigin !== '*' && parentOrigin !== event.origin) {
      log(
        `Child: Handshake - Received SYN-ACK from origin ${
          event.origin
        } which did not match expected origin ${parentOrigin}`
      );
      return;
    }

    log('Child: Handshake - Received SYN-ACK, responding with ACK');

    const ackMessage: AckMessage = {
      penpal: MessageType.Ack,
      methodNames: Object.keys(methods)
    };

    window.parent.postMessage(ackMessage, parentOrigin);

    const info: WindowsInfo = {
      localName: 'Child',
      local: window,
      remote: window.parent,
      originForSending: event.origin === 'null' ? '*' : event.origin,
      originForReceiving: event.origin
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
