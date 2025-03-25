import { SerializedError } from './types.js';
import PenpalError from './PenpalError.js';

/**
 * Converts an error object into a plain object.
 */
export const serializeError = (error: Error): SerializedError => ({
  name: error.name,
  message: error.message,
  stack: error.stack,
  penpalCode: error instanceof PenpalError ? error.code : undefined,
});

/**
 * Converts a plain object into an error object.
 */
export const deserializeError = ({
  name,
  message,
  stack,
  penpalCode,
}: SerializedError): Error => {
  const deserializedError = penpalCode
    ? new PenpalError(penpalCode, message)
    : new Error(message);

  deserializedError.name = name;
  deserializedError.stack = stack;

  return deserializedError;
};
