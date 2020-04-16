import { CallSender, Methods, WindowsInfo } from '../types';
import { Destructor } from '../createDestructor';
import connectCallReceiver from '../connectCallReceiver';
import connectCallSender from '../connectCallSender';

export default (
  methods: Methods,
  childOrigin: string,
  originForSending: string,
  destructor: Destructor,
  log: Function
) => {
  const { destroy, onDestroy } = destructor;
  let destroyCallReceiver: Function;
  let receiverMethodNames: string[];
  // We resolve the promise with the call sender. If the child reconnects
  // (for example, after refreshing or navigating to another page that
  // uses Penpal, we'll update the call sender with methods that match the
  // latest provided by the child.
  const callSender: CallSender = {};

  return (event: MessageEvent): CallSender|undefined => {
    if (event.origin !== childOrigin) {
      log(
        `Parent: Handshake - Received ACK message from origin ${
          event.origin
        } which did not match expected origin ${childOrigin}`
      );
      return;
    }

    log('Parent: Handshake - Received ACK');

    const info: WindowsInfo = {
      localName: 'Parent',
      local: window,
      remote: event.source as Window,
      originForSending: originForSending,
      originForReceiving: childOrigin
    };

    // If the child reconnected, we need to destroy the prior call receiver
    // before setting up a new one.
    if (destroyCallReceiver) {
      destroyCallReceiver();
    }

    destroyCallReceiver = connectCallReceiver(info, methods, log);
    onDestroy(destroyCallReceiver);

    // If the child reconnected, we need to remove the methods from the
    // previous call receiver off the sender.
    if (receiverMethodNames) {
      receiverMethodNames.forEach(receiverMethodName => {
        delete callSender[receiverMethodName];
      });
    }

    receiverMethodNames = event.data.methodNames;

    const destroyCallSender = connectCallSender(
      callSender,
      info,
      receiverMethodNames,
      destroy,
      log
    );

    onDestroy(destroyCallSender);

    return callSender;
  };
};
