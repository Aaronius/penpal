import { expectTypeOf } from 'vitest';
import { CallOptions, type RemoteProxy, type Reply } from '../../src/index.js';

type RemoteMethods = {
  generator(): AsyncGenerator<string, number>;
  iterator(): AsyncIterableIterator<number>;
  promisedGenerator(): Promise<AsyncGenerator<boolean>>;
  replyGenerator(): Reply<AsyncGenerator<Date>>;
  promisedReplyGenerator(): Promise<Reply<Promise<AsyncGenerator<bigint>>>>;
  iterableOnly(): AsyncIterable<string>;
  nativeStream(): ReadableStream<Uint8Array>;
  nested: {
    generator(): AsyncGenerator<'nested'>;
  };
};

declare const remote: RemoteProxy<RemoteMethods>;

expectTypeOf(remote.generator()).toEqualTypeOf<
  Promise<ReadableStream<string>>
>();
expectTypeOf(remote.generator(new CallOptions({ timeout: 100 }))).toEqualTypeOf<
  Promise<ReadableStream<string>>
>();
expectTypeOf(remote.iterator()).toEqualTypeOf<
  Promise<ReadableStream<number>>
>();
expectTypeOf(remote.promisedGenerator()).toEqualTypeOf<
  Promise<ReadableStream<boolean>>
>();
expectTypeOf(remote.replyGenerator()).toEqualTypeOf<
  Promise<ReadableStream<Date>>
>();
expectTypeOf(remote.promisedReplyGenerator()).toEqualTypeOf<
  Promise<ReadableStream<bigint>>
>();
expectTypeOf(remote.iterableOnly()).toEqualTypeOf<
  Promise<AsyncIterable<string>>
>();
expectTypeOf(remote.nativeStream()).toEqualTypeOf<
  Promise<ReadableStream<Uint8Array>>
>();
expectTypeOf(remote.nested.generator()).toEqualTypeOf<
  Promise<ReadableStream<'nested'>>
>();
