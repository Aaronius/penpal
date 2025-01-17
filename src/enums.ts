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
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}

export enum ContextType {
  Window = 'Window',
  Worker = 'Worker',
}
