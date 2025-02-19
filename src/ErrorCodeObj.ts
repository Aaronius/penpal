// Not intended to be used internally. Can be useful externally
// in projects not using TypeScript. It has the `Obj` suffix to disambiguate
// it from the ErrorCode string union.
const ErrorCodeObj = {
  ConnectionDestroyed: 'CONNECTION_DESTROYED',
  ConnectionTimeout: 'CONNECTION_TIMEOUT',
  InvalidArgument: 'INVALID_ARGUMENT',
  MethodCallTimeout: 'METHOD_CALL_TIMEOUT',
  MethodNotFound: 'METHOD_NOT_FOUND',
  TransmissionFailed: 'TRANSMISSION_FAILED',
} as const;

export default ErrorCodeObj;
