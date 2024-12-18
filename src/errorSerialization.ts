import { SerializedError } from './types';

/**
 * Converts an error object into a plain object.
 */
export const serializeError = ({
  name,
  message,
  stack,
}: Error): SerializedError => ({
  name,
  message,
  stack,
});

/**
 * Converts a plain object into an error object.
 */
export const deserializeError = (obj: SerializedError): Error => {
  const deserializedError = new Error();
  // @ts-expect-error TS gets confused and I don't know a clean way around it.
  Object.keys(obj).forEach((key) => (deserializedError[key] = obj[key]));
  return deserializedError;
};
