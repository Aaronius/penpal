import { ErrorCode } from './enums';

class PenpalError extends Error {
  public code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message); // Pass the message to the base Error class
    this.name = 'PenpalError'; // Set the name for the error
    this.code = code; // Assign the error code to a public property
  }
}

export default PenpalError;
