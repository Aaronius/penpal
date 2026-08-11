import type { SerializedError } from './types.js';
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
  // TypeScript declares Error.stack as `stack?: string`. With
  // exactOptionalPropertyTypes, that permits a missing property but rejects
  // assigning undefined. A serialized error can legitimately have no stack,
  // and Penpal must overwrite the locally generated stack with that undefined
  // value to preserve the remote error, so widen the property for this write.
  (deserializedError as { stack: string | undefined }).stack = stack;

  return deserializedError;
};
