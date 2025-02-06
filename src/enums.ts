export enum MessageType {
  Syn = 'SYN',
  Ack1 = 'ACK1',
  Ack2 = 'ACK2',
  Call = 'CALL',
  Reply = 'REPLY',
  Close = 'CLOSE',
}

export enum ErrorCode {
  ConnectionClosed = 'CONNECTION_CLOSED',
  ConnectionTimeout = 'CONNECTION_TIMEOUT',
  InvalidArgument = 'INVALID_ARGUMENT',
  MethodCallTimeout = 'METHOD_CALL_TIMEOUT',
  MethodNotFound = 'METHOD_NOT_FOUND',
  MessengerReused = 'MESSENGER_REUSED',
  TransmissionFailed = 'TRANSMISSION_FAILED',
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}
