import {
  CallOptions,
  PortMessenger,
  Reply,
  WebWorkerMessenger,
  connect,
  type Messenger,
  type MethodsShape,
} from 'penpal';

interface Calculator {
  add(left: number, right: number): number;
}

interface RemoteMethods {
  math: Calculator;
}

interface LocalMethods {
  log(message: string): void;
}

const methods: LocalMethods = {
  log(message) {
    console.log(message);
  },
};

function connectToWorker<T extends MethodsShape<T>>(messenger: Messenger) {
  return connect<T>({ messenger, methods });
}

const messenger = new WebWorkerMessenger({ worker: self });
const remote = await connectToWorker<RemoteMethods>(messenger).promise;
const result: number = await remote.math.add(1, 2);
void result;

declare const untypedMessenger: Messenger;
const untyped = await connect({ messenger: untypedMessenger }).promise;
const untypedResult = await untyped.math.add(1, 2);
// @ts-expect-error Without a remote methods type, the result is unknown.
const numberResult: number = untypedResult;
void numberResult;

declare const transferables: Transferable[];
void new CallOptions({ transferables });
const { port1, port2 } = new MessageChannel();
void new PortMessenger({ port: port1 });
void new Reply(port2, { transferables: [port2] });
