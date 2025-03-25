import { Reply } from '../../../src/index.js';

type FixtureMethods = {
  multiply(num1: number, num2: number): number;
  multiplyAsync(num1: number, num2: number): Promise<number>;
  double(numbers: Int32Array): Reply<Int32Array>;
  multiplyWithPromisedReplyInstanceAndPromisedReturnValue(
    num1: number,
    num2: number
  ): Promise<Reply<Promise<number>>>;
  getChannel(): string;
  getChannelFromParent(): string;
  addUsingParent(): void;
  getParentReturnValue(): number | undefined;
  getPromiseRejectedWithString(): Promise<string>;
  getPromiseRejectedWithObject(): Promise<Record<string, string>>;
  getPromiseRejectedWithUndefined(): Promise<void>;
  getPromiseRejectedWithError(): Promise<void>;
  throwError(): void;
  getUnclonableValue(): unknown;
  reload(): void;
  navigate(to: string): void;
  apply(): string;
  call(): string;
  bind(): string;
  nested: {
    oneLevel<T>(input: T): T;
    by: {
      twoLevels<T>(input: T): T;
    };
  };
  neverResolve(): Promise<void>;
  ['with.period'](): 'success';
  methodNotInGeneralPage: () => 'success';
};

export default FixtureMethods;
