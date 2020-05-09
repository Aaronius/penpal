type SerializedError = {
  name: string;
  message: string;
  stack: string | undefined;
};

/**
 * Converts an error object into a plain object.
 */
export const serializeError = ({
  name,
  message,
  stack
}: Error): SerializedError => ({
  name,
  message,
  stack
});

/**
 * Converts a plain object into an error object.
 */
export const deserializeError = (obj: SerializedError): Error => {
  const deserializedError = new Error();
  // @ts-ignore
  Object.keys(obj).forEach(key => (deserializedError[key] = obj[key]));
  return deserializedError;
};
