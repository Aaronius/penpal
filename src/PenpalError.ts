import type { ErrorCode } from './types.js';

class PenpalError extends Error {
  public code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PenpalError';
    this.code = code;
  }
}

export const wrapError = (code: ErrorCode, cause: unknown): PenpalError => {
  return new PenpalError(code, (cause as Error).message, { cause });
};

export default PenpalError;
