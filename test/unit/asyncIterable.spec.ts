import { describe, expect, it, vi } from 'vitest';
import {
  asyncIterableIteratorToReadableStream,
  isAsyncIterableIterator,
} from '../../src/asyncIterable.js';

describe('async iterable helpers', () => {
  it('recognizes async iterable iterators by behavior', () => {
    const generator = (async function* () {
      yield 'value';
    })();
    const iterableOnly: AsyncIterable<string> = {
      [Symbol.asyncIterator]() {
        return generator;
      },
    };
    const structuralIterator: AsyncIterableIterator<string> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        return Promise.resolve({ done: true, value: undefined });
      },
    };

    expect(isAsyncIterableIterator(generator)).toBe(true);
    expect(isAsyncIterableIterator(structuralIterator)).toBe(true);
    expect(isAsyncIterableIterator(iterableOnly)).toBe(false);
    expect(isAsyncIterableIterator(new ReadableStream())).toBe(false);
    expect(isAsyncIterableIterator(null)).toBe(false);
  });

  it('advances the iterator through stream pulls and closes on completion', async () => {
    const onFinished = vi.fn();
    const generator = (async function* () {
      yield 'first';
      await Promise.resolve();
      yield 'second';
      return 'ignored';
    })();
    const { readableStream } = asyncIterableIteratorToReadableStream(
      generator,
      onFinished,
    );
    const reader = readableStream.getReader();

    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: 'first',
    });
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: 'second',
    });
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('does not advance beyond native stream backpressure', async () => {
    const firstResult = Promise.withResolvers<IteratorResult<string>>();
    const secondResult = Promise.withResolvers<IteratorResult<string>>();
    const next = vi
      .fn<() => Promise<IteratorResult<string>>>()
      .mockReturnValueOnce(firstResult.promise)
      .mockReturnValueOnce(secondResult.promise);
    const iterator: AsyncIterableIterator<string> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next,
    };
    const { readableStream } = asyncIterableIteratorToReadableStream(
      iterator,
      () => {
        // no-op
      },
    );

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(1);
    });

    firstResult.resolve({ done: false, value: 'first' });
    await Promise.resolve();
    await Promise.resolve();
    expect(next).toHaveBeenCalledTimes(1);

    const reader = readableStream.getReader();
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: 'first',
    });
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(2);
    });

    secondResult.resolve({ done: true, value: undefined });
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it('errors the stream when iterator.next() rejects', async () => {
    const generator = (async function* () {
      yield 'first';
      throw new Error('iteration failed');
    })();
    const { readableStream } = asyncIterableIteratorToReadableStream(
      generator,
      () => {
        // no-op
      },
    );
    const reader = readableStream.getReader();

    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: 'first',
    });
    await expect(reader.read()).rejects.toThrow('iteration failed');
  });

  it('calls iterator.return() and propagates cleanup errors on cancellation', async () => {
    const cleanupError = new Error('cleanup failed');
    const iterator: AsyncIterableIterator<string> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next: vi.fn(() =>
        Promise.resolve({ done: false as const, value: 'value' }),
      ),
      return: vi.fn(() => Promise.reject(cleanupError)),
    };
    const { readableStream } = asyncIterableIteratorToReadableStream(
      iterator,
      () => {
        // no-op
      },
    );
    const reader = readableStream.getReader();

    await reader.read();
    await expect(reader.cancel()).rejects.toBe(cleanupError);
    expect(iterator.return).toHaveBeenCalledTimes(1);
  });

  it('calls iterator.return() and errors the stream when destroyed', async () => {
    const returnMethod = vi.fn(() =>
      Promise.resolve({ done: true as const, value: undefined }),
    );
    const iterator: AsyncIterableIterator<string> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        return Promise.resolve({ done: false, value: 'value' });
      },
      return: returnMethod,
    };
    const { readableStream, destroy } = asyncIterableIteratorToReadableStream(
      iterator,
      () => {
        // no-op
      },
    );
    const error = new Error('connection destroyed');

    await destroy(error);

    await expect(readableStream.getReader().read()).rejects.toBe(error);
    expect(returnMethod).toHaveBeenCalledTimes(1);
  });

  it('fails only when adaptation is attempted without ReadableStream support', () => {
    const iterator = (async function* () {
      yield 'value';
    })();

    vi.stubGlobal('ReadableStream', undefined);

    try {
      expect(() =>
        asyncIterableIteratorToReadableStream(iterator, () => {
          // no-op
        }),
      ).toThrow(
        'AsyncIterableIterator return values require ReadableStream support',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
