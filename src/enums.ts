export enum MessageType {
  Call = 'CALL',
  Reply = 'REPLY',
  Syn = 'SYN',
  SynAck = 'SYN_ACK',
  Ack = 'ACK',
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
