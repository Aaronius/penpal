import { expectTypeOf } from 'vitest';
import {
  CallOptions,
  connect,
  type Connection,
  type Messenger,
  type MethodsShape,
  type RemoteProxy,
} from '../../src/index.js';

interface Calculator {
  multiply(left: number, right: number): number;
}

interface WorkerMethods {
  math: Calculator;
}

interface LocalMethods {
  log(message: string): void;
  label: string;
}

declare const messenger: Messenger;
const methods: LocalMethods = {
  log(message) {
    console.log(message);
  },
  label: 'parent',
};

const connection = connect<WorkerMethods>({ messenger, methods });
expectTypeOf(connection).toEqualTypeOf<Connection<WorkerMethods>>();
const remote = await connection.promise;
expectTypeOf(remote.math.multiply(2, 6, new CallOptions())).toEqualTypeOf<
  Promise<number>
>();

// @ts-expect-error The declared methods type checks arguments.
void remote.math.multiply('2', 6);
// @ts-expect-error The declared methods type checks method names.
void remote.math.typo();
// @ts-expect-error Remote data properties are not callable methods.
void connect<{ math: { version: string } }>({ messenger });
// @ts-expect-error Symbol-keyed methods cannot be addressed by the protocol.
void connect<{ [Symbol.iterator](): number }>({ messenger });
// @ts-expect-error The local methods option requires an object.
void connect({ messenger, methods: 'not an object' });

function connectToWorker<T extends MethodsShape<T>>(endpoint: Messenger) {
  return connect<T>({ messenger: endpoint });
}
expectTypeOf(connectToWorker<WorkerMethods>(messenger)).toEqualTypeOf<
  Connection<WorkerMethods>
>();

const unspecified = connect({ messenger, methods });
expectTypeOf(unspecified).toEqualTypeOf<Connection>();
const untyped = await unspecified.promise;
// noUncheckedIndexedAccess treats arbitrary indexed names as possibly absent.
expectTypeOf(await untyped.multiply!(2, 6)).toEqualTypeOf<unknown>();
expectTypeOf(untyped.math!.multiply!(2, 6, new CallOptions())).toEqualTypeOf<
  Promise<unknown>
>();

const empty = await connect<Record<never, never>>({ messenger }).promise;
// @ts-expect-error An explicitly empty methods type has no declared methods.
void empty.multiply(2, 6);

declare const indexed: RemoteProxy<Record<string, (value: number) => string>>;
expectTypeOf(indexed.lookup!(1)).toEqualTypeOf<Promise<string>>();
// @ts-expect-error A typed dictionary retains its argument types.
void indexed.lookup!('1');
