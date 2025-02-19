import { ErrorCode } from './types';

class PenpalError extends Error {
  public code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'PenpalError';
    this.code = code;
  }
}

export default PenpalError;
