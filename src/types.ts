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
import { ErrorCode, MessageType, Resolution } from './enums';

export type WindowsInfo = {
  localName: string,
  local: Window,
  remote: Window,
  originForSending: string,
  originForReceiving: string
};

export type Methods = {
  [index: string]: Function
};

export type ReplyMessage = {
  penpal: MessageType.Reply;
  id: number;
  resolution: Resolution;
  returnValue: any;
  returnValueIsError?: boolean;
};

export type CallMessage = {
  penpal: MessageType.Call;
  id: number;
  methodName: string;
  args: any[]
}

export type HandshakeMessage = {
  penpal: MessageType.Handshake | MessageType.HandshakeReply,
  methodNames: string[]
}

export type CallSender = {
  [index: string]: Function
}

export type PenpalError = Error & { code: ErrorCode }
