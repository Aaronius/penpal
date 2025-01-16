import assertType from './assertType';
import {
  connectToChild,
  MethodCallOptions,
  RemoteMethodProxies,
  Reply,
} from '../../src/index';

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

const connection = connectToChild<ChildMethods>({
  child: document.createElement('iframe'),
});

const child = await connection.promise;
assertType<RemoteMethodProxies<ChildMethods>>(child);
assertType<Promise<number>>(child.multiply(2, 3));
assertType<Promise<number>>(child.multiplyWithPromisedValue(2, 3));
assertType<Promise<number>>(child.multiply(2, 3, new MethodCallOptions()));
assertType<Promise<number>>(child.multiply(2, 3, new MethodCallOptions({})));
assertType<Promise<number>>(
  child.multiply(2, 3, new MethodCallOptions({ transferables: [] }))
);
// @ts-expect-error Message options must be an instance of MethodCallOptions.
void child.multiply(2, 3, { transferables: [] });
assertType<Promise<number>>(child.multiplyWithReplyInstance(2, 3));
assertType<Promise<number>>(child.multiplyWithPromisedReplyInstance(2, 3));
assertType<Promise<number>>(
  child.multiplyWithReplyInstanceAndPromisedReturnValue(2, 3)
);
assertType<Promise<number>>(
  child.multiplyWithPromisedReplyInstanceAndPromisedReturnValue(2, 3)
);
// A returned object with a reply-like structure should not be interpreted as a Reply instance, so the result here is correct.
assertType<Promise<{ value: number }>>(child.multiplyWithReplyLikeObject(2, 3));

const input1DataView = new DataView(new ArrayBuffer(4));
input1DataView.setInt32(0, 2);
const input2DataView = new DataView(new ArrayBuffer(4));
input2DataView.setInt32(0, 5);
assertType<Promise<DataView>>(
  child.multiplyWithTransferables(
    input1DataView,
    input2DataView,
    new MethodCallOptions({
      transferables: [input1DataView.buffer, input2DataView.buffer],
    })
  )
);
