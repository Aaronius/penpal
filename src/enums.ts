export enum MessageType {
  Call = 'call',
  Reply = 'reply',
  Syn = 'syn',
  SynAck = 'synAck',
  Ack = 'ack',
}

export enum Resolution {
  Fulfilled = 'fulfilled',
  Rejected = 'rejected',
}

export enum ErrorCode {
  ConnectionDestroyed = 'ConnectionDestroyed',
  ConnectionTimeout = 'ConnectionTimeout',
  OriginRequired = 'OriginRequired',
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}

export enum NativeEventType {
  Message = 'message',
}
