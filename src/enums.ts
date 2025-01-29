export enum MessageType {
  Call = 'call',
  Reply = 'reply',
  Syn = 'syn',
  SynAck = 'synAck',
  Ack = 'ack',
}

export enum ErrorCode {
  ConnectionClosed = 'ConnectionClosed',
  ConnectionTimeout = 'ConnectionTimeout',
  MethodCallTimeout = 'MethodCallTimeout',
  TransmissionFailed = 'TransmissionFailed',
  InvalidArgument = 'InvalidArgument',
  MethodNotFound = 'MethodNotFound',
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}
