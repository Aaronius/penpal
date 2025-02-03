import { Reply } from '../../../src/index';

type FixtureMethods = {
  multiply(num1: number, num2: number): number;
  multiplyAsync(num1: number, num2: number): Promise<number>;
  multiplyUsingTransferables(
    num1DataView: DataView,
    num2DataView: DataView
  ): Reply<DataView>;
  multiplyWithPromisedReplyInstanceAndPromisedReturnValue(
    num1: number,
    num2: number
  ): Promise<Reply<Promise<number>>>;
  getChannel(): string;
  getChannelFromParent(): string;
  addUsingParent(): void;
  getParentReturnValue(): number | undefined;
  getPromiseRejectedWithObject(): Promise<Record<string, string>>;
  getPromiseRejectedWithError(): Promise<void>;
  getPromiseRejectedWithUndefined(): Promise<void>;
  throwError(): void;
  getUnclonableValue(): unknown;
  reload(): void;
  navigate(to: string): void;
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
