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
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}
