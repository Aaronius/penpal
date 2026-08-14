import { isFunction, isObject } from './guards.js';
import PenpalError from './PenpalError.js';

/**
 * A readable stream together with the connection-level cleanup Penpal needs
 * to stop its source iterator when the connection is destroyed.
 */
export type ManagedReadableStream = {
  readonly readableStream: ReadableStream<unknown>;
  destroy: (reason: unknown) => Promise<void>;
};

/**
 * This feature intentionally recognizes async iterable iterators, rather than
 * every async iterable. The two capabilities are related but distinct:
 * `Symbol.asyncIterator` means that a value can participate in async
 * iteration, while `next()` means that the value is the iterator that Penpal
 * can advance directly.
 *
 * Requiring both is particularly important for `ReadableStream`. A stream is
 * async iterable because it can create an iterator, but it is not itself an
 * iterator and therefore has no `next()` method. Native `ReadableStream`
 * values may already be transferred explicitly and must not be mistaken for
 * async-generator results and wrapped in another stream. Conversely, checking
 * only for `next()` would match arbitrary iterator-like or application objects
 * that do not implement the async-iteration contract.
 *
 * This is a structural check instead of an `instanceof`, constructor-name, or
 * method-declaration check so it continues to work across JavaScript realms
 * and after transpilation or minification. We also avoid invoking
 * `Symbol.asyncIterator` to verify that it returns this same object: detection
 * should not execute user code or introduce observable side effects.
 */
export const isAsyncIterableIterator = (
  value: unknown,
): value is AsyncIterableIterator<unknown> => {
  return (
    isObject(value) &&
    isFunction(value[Symbol.asyncIterator]) &&
    isFunction(value.next)
  );
};

export const asyncIterableIteratorToReadableStream = (
  iterator: AsyncIterableIterator<unknown>,
  onFinished: () => void,
): ManagedReadableStream => {
  if (typeof globalThis.ReadableStream !== 'function') {
    throw new PenpalError(
      'TRANSMISSION_FAILED',
      'AsyncIterableIterator return values require ReadableStream support',
    );
  }

  let controller: ReadableStreamDefaultController<unknown>;
  let isFinished = false;
  let returnPromise: Promise<void> | undefined;

  const finish = () => {
    if (isFinished) {
      return false;
    }

    isFinished = true;
    onFinished();
    return true;
  };

  const returnIterator = (): Promise<void> => {
    if (returnPromise) {
      return returnPromise;
    }

    if (!finish()) {
      return Promise.resolve();
    }

    returnPromise = (async () => {
      await iterator.return?.();
    })();
    return returnPromise;
  };

  const readableStream = new globalThis.ReadableStream({
    start(streamController) {
      controller = streamController;
    },
    async pull(streamController) {
      if (isFinished) {
        return;
      }

      let result: IteratorResult<unknown>;

      try {
        result = await iterator.next();
      } catch (error) {
        streamController.error(error);

        try {
          await returnIterator();
        } catch (cleanupError) {
          console.error(cleanupError);
        }
        return;
      }

      if (isFinished) {
        return;
      }

      if (result.done) {
        finish();
        streamController.close();
        return;
      }

      streamController.enqueue(result.value);
    },
    cancel() {
      return returnIterator();
    },
  });

  return {
    readableStream,
    destroy(reason) {
      if (!isFinished) {
        controller.error(reason);
      }

      return returnIterator();
    },
  };
};
