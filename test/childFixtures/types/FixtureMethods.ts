import Reply from '../../../src/Reply';

type FixtureMethods = {
  multiply(num1: number, num2: number): number;
  multiplyAsync(num1: number, num2: number): Promise<number>;
  multiplyUsingTransferables(
    num1DataView: DataView,
    num2DataView: DataView
  ): Reply<DataView>;
  addUsingParent(): void;
  getParentReturnValue(): number | undefined;
  getRejectedPromiseString(): Promise<void>;
  getRejectedPromiseError(): Promise<void>;
  throwError(): void;
  getUnclonableValue(): Window | typeof globalThis;
  reload(): void;
  navigate(to: string): void;
  nested: {
    oneLevel<T>(input: T): T;
    by: {
      twoLevels<T>(input: T): T;
    };
  };
  neverResolve(): Promise<void>;
  methodNotInDefaultPage: () => 'string';
};

export default FixtureMethods;
