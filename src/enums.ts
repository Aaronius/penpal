export enum MessageType {
  Syn = 'SYN',
  Ack1 = 'ACK1',
  Ack2 = 'ACK2',
  Call = 'CALL',
  Reply = 'REPLY',
  Destroy = 'DESTROY',
}

export enum ErrorCode {
  ConnectionDestroyed = 'CONNECTION_DESTROYED',
  ConnectionTimeout = 'CONNECTION_TIMEOUT',
  InvalidArgument = 'INVALID_ARGUMENT',
  MethodCallTimeout = 'METHOD_CALL_TIMEOUT',
  MethodNotFound = 'METHOD_NOT_FOUND',
  TransmissionFailed = 'TRANSMISSION_FAILED',
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}
