import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { MessageChannel, Worker } from 'node:worker_threads';

for (const format of ['esm', 'cjs']) {
  const {
    CallOptions,
    NodeWorkerMessenger,
    WebWorkerMessenger,
    WorkerMessenger,
    connect,
  } =
    format === 'cjs'
      ? createRequire(import.meta.url)('penpal')
      : await import('penpal');

  const startWorker = (t, channels) => {
    const worker = new Worker(
      new URL('./fixtures/worker.js', import.meta.url),
      {
        workerData: { format, channels },
      },
    );
    t.after(() => worker.terminate());
    return worker;
  };

  const startConnection = (t, worker = startWorker(t), channel) => {
    const connection = connect({
      messenger: new NodeWorkerMessenger({ worker }),
      timeout: 2000,
      channel,
      methods: {
        async add(left, right) {
          return left + right;
        },
      },
    });
    t.after(() => connection.destroy());
    return connection;
  };

  void describe(`NodeWorkerMessenger (${format})`, { timeout: 10000 }, () => {
    void it('retains WorkerMessenger as the same class as WebWorkerMessenger', () => {
      assert.equal(WorkerMessenger, WebWorkerMessenger);
    });

    void it('rejects a missing worker', () => {
      assert.throws(() => new NodeWorkerMessenger({ worker: undefined }), {
        code: 'INVALID_ARGUMENT',
      });
    });

    void it('calls synchronous and asynchronous methods in both directions', async (t) => {
      const connection = startConnection(t);
      const remote = await connection.promise;
      assert.equal(await remote.multiply(2, 6), 12);
      assert.equal(await remote.callParent(2, 6), 8);
    });

    void it('preserves errors from synchronous and asynchronous methods', async (t) => {
      const remote = await startConnection(t).promise;
      await assert.rejects(remote.fail(), {
        name: 'TypeError',
        message: 'Worker method failed',
      });
      await assert.rejects(remote.failAsync(), {
        name: 'RangeError',
        message: 'Async worker method failed',
      });
    });

    void it('transfers ArrayBuffers in calls and replies', async (t) => {
      const remote = await startConnection(t).promise;
      const buffer = new ArrayBuffer(16);
      const length = remote.bufferLength(
        buffer,
        new CallOptions({ transferables: [buffer] }),
      );
      assert.equal(buffer.byteLength, 0);
      assert.equal(await length, 16);
      assert.deepEqual(
        new Uint8Array(await remote.createBuffer()),
        new Uint8Array([1, 2, 3]),
      );
    });

    void it('transfers MessagePorts in calls and replies', async (t) => {
      const remote = await startConnection(t).promise;
      const { port1, port2 } = new MessageChannel();
      t.after(() => port1.close());
      const received = remote.readPort(
        port2,
        new CallOptions({ transferables: [port2] }),
      );
      port1.postMessage('from parent');
      assert.equal(await received, 'from parent');

      const returnedPort = await remote.createPort();
      t.after(() => returnedPort.close());
      const reply = once(returnedPort, 'message');
      returnedPort.postMessage('through returned port');
      assert.deepEqual(await reply, ['through returned port']);
    });

    void it('keeps parallel connections isolated by channel', async (t) => {
      const worker = startWorker(t, ['first', 'second']);
      const first = startConnection(t, worker, 'first');
      const second = startConnection(t, worker, 'second');
      const [firstRemote, secondRemote] = await Promise.all([
        first.promise,
        second.promise,
      ]);
      assert.deepEqual(
        await Promise.all([firstRemote.identify(), secondRemote.identify()]),
        ['first', 'second'],
      );

      first.destroy();
      assert.equal(
        await secondRemote.identify(new CallOptions({ timeout: 1000 })),
        'second',
      );
    });

    void it('removes its listeners and rejects pending calls on destruction', async (t) => {
      const worker = startWorker(t);
      const messageListeners = worker.listenerCount('message');
      const exitListeners = worker.listenerCount('exit');
      const connection = startConnection(t, worker);
      const remote = await connection.promise;
      assert.equal(worker.listenerCount('message'), messageListeners + 1);
      assert.equal(worker.listenerCount('exit'), exitListeners + 1);
      const pending = assert.rejects(remote.neverResolve(), {
        code: 'CONNECTION_DESTROYED',
      });
      connection.destroy();
      await pending;
      assert.equal(worker.listenerCount('message'), messageListeners);
      assert.equal(worker.listenerCount('exit'), exitListeners);
      assert.throws(() => remote.multiply(2, 6), {
        code: 'CONNECTION_DESTROYED',
      });
    });

    void it('rejects the pending connection when the worker exits before the handshake completes', async (t) => {
      const worker = new Worker('', { eval: true });
      t.after(() => worker.terminate());
      const connection = connect({
        messenger: new NodeWorkerMessenger({ worker }),
      });

      await assert.rejects(connection.promise, {
        code: 'CONNECTION_DESTROYED',
      });
      assert.equal(worker.listenerCount('message'), 0);
      assert.equal(worker.listenerCount('exit'), 0);
    });

    void it('rejects pending calls locally when the worker is terminated', async (t) => {
      const worker = startWorker(t);
      const connection = startConnection(t, worker);
      const remote = await connection.promise;
      const pending = assert.rejects(remote.neverResolve(), {
        code: 'CONNECTION_DESTROYED',
      });
      const postMessage = t.mock.method(worker, 'postMessage');

      await worker.terminate();
      await pending;

      assert.equal(postMessage.mock.callCount(), 0);
      assert.equal(worker.listenerCount('message'), 0);
      assert.equal(worker.listenerCount('exit'), 0);
      assert.throws(() => remote.multiply(2, 6), {
        code: 'CONNECTION_DESTROYED',
      });
    });

    void it('handles destruction initiated by the worker', async (t) => {
      const worker = startWorker(t);
      const connection = startConnection(t, worker);
      const remote = await connection.promise;
      const pending = assert.rejects(remote.neverResolve(), {
        code: 'CONNECTION_DESTROYED',
      });
      await remote.disconnect();
      await pending;
      assert.equal(worker.listenerCount('message'), 0);
      assert.equal(worker.listenerCount('exit'), 0);
    });

    void it('times out when no matching channel connects', async (t) => {
      const worker = startWorker(t, ['other']);
      const connection = connect({
        messenger: new NodeWorkerMessenger({ worker }),
        channel: 'missing',
        timeout: 100,
      });
      await assert.rejects(connection.promise, { code: 'CONNECTION_TIMEOUT' });
      assert.equal(worker.listenerCount('message'), 0);
      assert.equal(worker.listenerCount('exit'), 0);
    });

    void it('delivers valid messages until the messenger is destroyed', async (t) => {
      const worker = new Worker(new URL('./fixtures/echo.js', import.meta.url));
      t.after(() => worker.terminate());
      const messenger = new NodeWorkerMessenger({ worker });
      t.after(() => messenger.destroy());
      const received = [];
      const accepted = Promise.withResolvers();
      messenger.initialize({
        validateReceivedMessage: (value) => value?.type === 'DESTROY',
        onMessage: (message) => {
          received.push(message);
          accepted.resolve();
        },
      });
      // Worker messages from one endpoint arrive in order, so the DESTROY
      // payload provides a barrier after the invalid payloads.
      worker.postMessage(null);
      worker.postMessage({ unrelated: true });
      messenger.sendMessage({ type: 'DESTROY' });
      await accepted.promise;
      assert.deepEqual(received, [{ type: 'DESTROY' }]);
      messenger.destroy();
      assert.equal(worker.listenerCount('message'), 0);
      const ignored = once(worker, 'message');
      worker.postMessage({ type: 'DESTROY' });
      await ignored;
      assert.equal(received.length, 1);
    });
  });
}
