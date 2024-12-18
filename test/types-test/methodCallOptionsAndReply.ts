import assertType from './assertType';
import {
  connectToChildIframe,
  MethodCallOptions,
  Remote,
  Reply,
} from '../../src/index';

const childMethods = {
  multiply(a: number, b: number) {
    return a * b;
  },
  multiplyWithPromisedValue(a: number, b: number) {
    return Promise.resolve(a * b);
  },
  multiplyWithReplyInstance(a: number, b: number) {
    return new Reply(a * b);
  },
  multiplyWithPromisedReplyInstance(a: number, b: number) {
    return Promise.resolve(new Reply(a * b));
  },
  multiplyWithReplyInstanceAndPromisedValue(a: number, b: number) {
    return new Reply(Promise.resolve(a * b));
  },
  multiplyWithPromisedReplyInstanceAndPromisedValue(a: number, b: number) {
    return Promise.resolve(new Reply(Promise.resolve(a * b)));
  },
  multiplyWithReplyLikeObject(a: number, b: number) {
    return {
      returnValue: a * b,
    };
  },
  multiplyWithTransferables(aDataView: DataView, bDataView: DataView) {
    const a = aDataView.getInt32(0);
    const b = bDataView.getInt32(0);
    const returnValue = new DataView(new ArrayBuffer(4));
    returnValue.setInt32(0, a * b);
    return new Reply(returnValue, {
      transfer: [returnValue.buffer],
    });
  },
};

type ChildMethods = typeof childMethods;

const connection = connectToChildIframe<ChildMethods>({
  iframe: document.createElement('iframe'),
});

const child = await connection.promise;
assertType<Remote<ChildMethods>>(child);
assertType<Promise<number>>(child.multiply(2, 3));
assertType<Promise<number>>(child.multiplyWithPromisedValue(2, 3));
assertType<Promise<number>>(child.multiply(2, 3, new MethodCallOptions()));
assertType<Promise<number>>(child.multiply(2, 3, new MethodCallOptions({})));
assertType<Promise<number>>(
  child.multiply(2, 3, new MethodCallOptions({ transfer: [] }))
);
// @ts-expect-error Message options must be an instance of MethodCallOptions.
void child.multiply(2, 3, { transfer: [] });
assertType<Promise<number>>(child.multiplyWithReplyInstance(2, 3));
assertType<Promise<number>>(child.multiplyWithPromisedReplyInstance(2, 3));
assertType<Promise<number>>(
  child.multiplyWithReplyInstanceAndPromisedValue(2, 3)
);
assertType<Promise<number>>(
  child.multiplyWithPromisedReplyInstanceAndPromisedValue(2, 3)
);
// A returned object with a reply-like structure should not be interpreted as a Reply instance, so the result here is correct.
assertType<Promise<{ returnValue: number }>>(
  child.multiplyWithReplyLikeObject(2, 3)
);

const input1DataView = new DataView(new ArrayBuffer(4));
input1DataView.setInt32(0, 2);
const input2DataView = new DataView(new ArrayBuffer(4));
input2DataView.setInt32(0, 5);
assertType<Promise<DataView>>(
  child.multiplyWithTransferables(
    input1DataView,
    input2DataView,
    new MethodCallOptions({
      transfer: [input1DataView.buffer, input2DataView.buffer],
    })
  )
);
