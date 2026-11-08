import { Worker, parentPort, MessageChannel } from 'node:worker_threads';
import {
  CallOptions,
  NodeWorkerMessenger,
  PortMessenger,
  Reply,
  connect,
  type RemoteProxy,
} from 'penpal';

declare const worker: Worker;
// Leave these types inferred to check that a CommonJS consumer can emit them.
export const connectToWorker = () =>
  connect({ messenger: new NodeWorkerMessenger({ worker }) });
export const remotePromise = connectToWorker().promise;

const { port1, port2 } = new MessageChannel();
void new CallOptions({ transferables: [port1] });
void new Reply(port2, { transferables: [port2] });

declare const remote: RemoteProxy<{
  multiply(left: number, right: number): number;
}>;
const result: Promise<number> = remote.multiply(2, 6);
void result;

if (parentPort) {
  void connect({ messenger: new PortMessenger({ port: parentPort }) });
}
