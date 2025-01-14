export enum MessageType {
  Call = 'call',
  Reply = 'reply',
  Syn = 'syn',
  SynAck = 'synAck',
  Ack = 'ack',
}

export enum ErrorCode {
  ConnectionDestroyed = 'ConnectionDestroyed',
  ConnectionTimeout = 'ConnectionTimeout',
  OriginRequired = 'OriginRequired',
  MethodCallTimeout = 'MethodCallTimeout',
}

export enum NativeErrorName {
  DataCloneError = 'DataCloneError',
}

export enum ContextType {
  Window = 'Window',
  Worker = 'Worker',
}
