export enum MessageType {
  Call = 'CALL',
  Reply = 'REPLY',
  Syn = 'SYN',
  Ack1 = 'ACK1',
  Ack2 = 'ACK2',
}

export enum ErrorCode {
  ConnectionClosed = 'CONNECTION_CLOSED',
  ConnectionTimeout = 'CONNECTION_TIMEOUT',
  MethodCallTimeout = 'METHOD_CALL_TIMEOUT',
  TransmissionFailed = 'TRANSMISSION_FAILED',
  InvalidArgument = 'INVALID_ARGUMENT',
  MethodNotFound = 'METHOD_NOT_FOUND',
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}
