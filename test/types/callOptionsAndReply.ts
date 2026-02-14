import { expectTypeOf } from 'vitest';
import {
  connect,
  CallOptions,
  WindowMessenger,
  Connection,
  RemoteProxy,
  Reply,
} from '../../src/index.js';

type ChildMethods = {
  multiply(a: number, b: number): number;
  multiplyWithPromisedValue(a: number, b: number): Promise<number>;
  multiplyWithReplyInstance(a: number, b: number): Reply<number>;
  multiplyWithPromisedReplyInstance(
    a: number,
    b: number
  ): Promise<Reply<number>>;
  multiplyWithReplyInstanceAndPromisedReturnValue(
    a: number,
    b: number
  ): Reply<Promise<number>>;
  multiplyWithPromisedReplyInstanceAndPromisedReturnValue(
    a: number,
    b: number
  ): Promise<Reply<Promise<number>>>;
  multiplyWithReplyLikeObject(a: number, b: number): { value: number };
  multiplyWithTransferables(
    aDataView: DataView,
    bDataView: DataView
  ): Reply<DataView>;
};

declare const messenger: WindowMessenger;

const connection = connect<ChildMethods>({ messenger });
expectTypeOf(connection).toEqualTypeOf<Connection<ChildMethods>>();
expectTypeOf(connection.promise).toEqualTypeOf<
  Promise<RemoteProxy<ChildMethods>>
>();

declare const child: RemoteProxy<ChildMethods>;

expectTypeOf(child.multiply(2, 3)).toEqualTypeOf<Promise<number>>();
expectTypeOf(child.multiplyWithPromisedValue(2, 3)).toEqualTypeOf<
  Promise<number>
>();
expectTypeOf(child.multiply(2, 3, new CallOptions())).toEqualTypeOf<
  Promise<number>
>();
expectTypeOf(child.multiply(2, 3, new CallOptions({}))).toEqualTypeOf<
  Promise<number>
>();
expectTypeOf(
  child.multiply(2, 3, new CallOptions({ transferables: [] }))
).toEqualTypeOf<Promise<number>>();
// @ts-expect-error Message options must be an instance of CallOptions.
void child.multiply(2, 3, { transferables: [] });
expectTypeOf(child.multiplyWithReplyInstance(2, 3)).toEqualTypeOf<
  Promise<number>
>();
expectTypeOf(child.multiplyWithPromisedReplyInstance(2, 3)).toEqualTypeOf<
  Promise<number>
>();
expectTypeOf(
  child.multiplyWithReplyInstanceAndPromisedReturnValue(2, 3)
).toEqualTypeOf<Promise<number>>();
expectTypeOf(
  child.multiplyWithPromisedReplyInstanceAndPromisedReturnValue(2, 3)
).toEqualTypeOf<Promise<number>>();
const replyLikeResult = child.multiplyWithReplyLikeObject(2, 3);
// @ts-expect-error A reply-like structure should not be interpreted as a Reply instance.
const _replyLikeShouldNotBeReply: Promise<Reply> = replyLikeResult;

declare const input1DataView: DataView;
declare const input2DataView: DataView;
expectTypeOf(
  child.multiplyWithTransferables(
    input1DataView,
    input2DataView,
    new CallOptions({
      transferables: [input1DataView.buffer, input2DataView.buffer],
    })
  )
).toEqualTypeOf<Promise<DataView>>();
