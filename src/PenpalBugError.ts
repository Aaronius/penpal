/**
 * Error class that is thrown when we've reached a situation that we believe to
 * be a bug in Penpal and not anything the consumer has done.
 */
class PenpalBugError extends Error {
  constructor(message: string) {
    super(
      `You've hit a bug in Penpal. Please file an issue with the following information: ${message}`
    );
  }
}

export default PenpalBugError;
