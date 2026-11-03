import { MessageChannel, Worker, parentPort } from 'node:worker_threads';
import type { FileHandle } from 'node:fs/promises';
import {
  CallOptions,
  NodeWorkerMessenger,
  PortMessenger,
  Reply,
  connect,
  type RemoteProxy,
} from 'penpal';

const worker = new Worker(new URL('./worker.js', import.meta.url));
const connection = connect({
  messenger: new NodeWorkerMessenger({ worker }),
});

const { port1, port2 } = new MessageChannel();
void new PortMessenger({ port: port1 });
void new PortMessenger({ port: port2 });
void new CallOptions({ transferables: [port1] });
void new Reply(port2, { transferables: [port2] });

declare const file: FileHandle;
void new CallOptions({ transferables: [file] });

declare const remote: RemoteProxy<{
  multiply(left: number, right: number): number;
}>;
const result: Promise<number> = remote.multiply(2, 6);
void result;

// @ts-expect-error Null cannot be transferred.
void new CallOptions({ transferables: [null] });

if (parentPort) {
  void connect({ messenger: new PortMessenger({ port: parentPort }) });
}

void connection;
