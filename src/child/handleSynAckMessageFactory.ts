/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

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
