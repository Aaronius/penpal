import {
  connect,
  PortMessenger,
  Reply,
  type Methods,
  type RemoteProxy,
} from '../../src/index.js';

const activeConnections = new Set<{ destroy: () => void }>();

const createConnectionPair = async <TMethods extends Methods>(
  methods: Methods,
): Promise<{
  producerConnection: { destroy: () => void };
  consumerConnection: { destroy: () => void };
  remote: RemoteProxy<TMethods>;
}> => {
  const { port1, port2 } = new MessageChannel();
  const producerConnection = connect({
    messenger: new PortMessenger({ port: port1 }),
    methods,
  });
  const consumerConnection = connect<TMethods>({
    messenger: new PortMessenger({ port: port2 }),
  });

  activeConnections.add(producerConnection);
  activeConnections.add(consumerConnection);

  const [remote] = await Promise.all([
    consumerConnection.promise,
    producerConnection.promise,
  ]);

  return { producerConnection, consumerConnection, remote };
};

describe('async iterable method results', () => {
  afterEach(() => {
    for (const connection of activeConnections) {
      connection.destroy();
    }

    activeConnections.clear();
  });

  it('supports native transferable ReadableStreams in the browser environment', async () => {
    const { port1, port2 } = new MessageChannel();
    const receivedStreamPromise = new Promise<ReadableStream<string>>(
      (resolve) => {
        port2.onmessage = ({ data }) => resolve(data as ReadableStream<string>);
      },
    );
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('supported');
        controller.close();
      },
    });

    port1.postMessage(stream, [stream]);

    const reader = (await receivedStreamPromise).getReader();
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: 'supported',
    });
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });

    port1.close();
    port2.close();
  });

  it('streams asynchronously yielded values and ignores the generator return value', async () => {
    const { remote } = await createConnectionPair<{
      search(): AsyncGenerator<string, string>;
    }>({
      async *search() {
        yield 'a';
        await new Promise((resolve) => setTimeout(resolve, 0));
        yield 'b';
        return 'not streamed';
      },
    });
    const stream = await remote.search();
    const values: string[] = [];

    expect(stream).toEqual(expect.any(ReadableStream));

    for await (const value of stream) {
      values.push(value);
    }

    expect(values).toEqual(['a', 'b']);
  });

  it('runs generator cleanup when the consumer stops iterating early', async () => {
    const cleanup = Promise.withResolvers<void>();
    const { remote } = await createConnectionPair<{
      search(): AsyncGenerator<number>;
    }>({
      async *search() {
        try {
          let value = 0;
          while (true) {
            yield value++;
          }
        } finally {
          cleanup.resolve();
        }
      },
    });
    const stream = await remote.search();

    for await (const value of stream) {
      expect(value).toBe(0);
      break;
    }

    await cleanup.promise;
  });

  it('surfaces generator errors after already yielding values', async () => {
    const { remote } = await createConnectionPair<{
      search(): AsyncGenerator<string>;
    }>({
      async *search() {
        yield 'first';
        throw new Error('stream failed');
      },
    });
    const stream = await remote.search();
    const values: string[] = [];
    let caughtError: unknown;

    try {
      for await (const value of stream) {
        values.push(value);
      }
    } catch (error) {
      caughtError = error;
    }

    expect(values).toEqual(['first']);
    expect(caughtError).toEqual(
      expect.objectContaining({ message: 'stream failed' }),
    );
  });

  it('relies on native stream transfer errors and cleans up for an unclonable chunk', async () => {
    const cleanup = Promise.withResolvers<void>();
    const { remote } = await createConnectionPair<{
      search(): AsyncGenerator<unknown>;
    }>({
      async *search() {
        try {
          yield window;
        } finally {
          cleanup.resolve();
        }
      },
    });
    const reader = (await remote.search()).getReader();
    const error = await reader.read().catch((caughtError) => {
      return caughtError as Error;
    });

    expect(error).toEqual(expect.any(Error));
    expect(error.name).toBe('DataCloneError');
    await cleanup.promise;
  });

  it.each(['producer', 'consumer'] as const)(
    'cleans up an active generator when the %s connection is destroyed',
    async (connectionToDestroy) => {
      const cleanup = Promise.withResolvers<void>();
      const { producerConnection, consumerConnection, remote } =
        await createConnectionPair<{
          search(): AsyncGenerator<string>;
        }>({
          async *search() {
            try {
              while (true) {
                yield 'value';
              }
            } finally {
              cleanup.resolve();
            }
          },
        });
      const reader = (await remote.search()).getReader();

      await expect(reader.read()).resolves.toEqual({
        done: false,
        value: 'value',
      });

      if (connectionToDestroy === 'producer') {
        producerConnection.destroy();
      } else {
        consumerConnection.destroy();
      }

      await cleanup.promise;
    },
  );

  it('keeps simultaneous streaming calls independent', async () => {
    const { remote } = await createConnectionPair<{
      search(prefix: string): AsyncGenerator<string>;
    }>({
      async *search(prefix: string) {
        yield `${prefix}-1`;
        await Promise.resolve();
        yield `${prefix}-2`;
      },
    });

    const collect = async (stream: ReadableStream<string>) => {
      const values: string[] = [];
      for await (const value of stream) {
        values.push(value);
      }
      return values;
    };

    const [firstStream, secondStream] = await Promise.all([
      remote.search('first'),
      remote.search('second'),
    ]);

    await expect(
      Promise.all([collect(firstStream), collect(secondStream)]),
    ).resolves.toEqual([
      ['first-1', 'first-2'],
      ['second-1', 'second-2'],
    ]);
  });

  it('does not reinterpret an explicitly transferred ReadableStream', async () => {
    const { remote } = await createConnectionPair<{
      getStream(): Reply<ReadableStream<string>>;
    }>({
      getStream() {
        const stream = new ReadableStream<string>({
          start(controller) {
            controller.enqueue('native stream');
            controller.close();
          },
        });
        return new Reply(stream, { transferables: [stream] });
      },
    });
    const reader = (await remote.getStream()).getReader();

    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: 'native stream',
    });
    await expect(reader.read()).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it('preserves Reply transferables when adapting its iterator value', async () => {
    const transferredBuffer = new ArrayBuffer(8);
    const { remote } = await createConnectionPair<{
      getStream(): Reply<AsyncGenerator<string>>;
    }>({
      getStream() {
        return new Reply(
          (async function* () {
            yield 'from reply';
          })(),
          { transferables: [transferredBuffer] },
        );
      },
    });
    const reader = (await remote.getStream()).getReader();

    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: 'from reply',
    });
    expect(transferredBuffer.byteLength).toBe(0);
  });

  it('preserves ordinary synchronous and asynchronous return values', async () => {
    const { remote } = await createConnectionPair<{
      syncValue(): string;
      asyncValue(): Promise<string>;
    }>({
      syncValue() {
        return 'sync';
      },
      asyncValue() {
        return Promise.resolve('async');
      },
    });

    await expect(remote.syncValue()).resolves.toBe('sync');
    await expect(remote.asyncValue()).resolves.toBe('async');
  });
});
