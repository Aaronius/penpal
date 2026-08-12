import { connect, type Connection, type Messenger } from 'penpal';

export type RemoteMethods = {
  multiply: (left: number, right: number) => number;
  divide: (dividend: number, divisor: number) => Promise<number>;
};

export type ParentMethods = {
  add: (left: number, right: number) => number;
};

export type ResultKey = 'add' | 'divide' | 'multiply';
export type ReportResult = (key: ResultKey, value: number) => void;

const createRemoteMethods = (): RemoteMethods => {
  return {
    multiply(left, right) {
      return left * right;
    },
    async divide(dividend, divisor) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
      });

      return dividend / divisor;
    },
  };
};

export const connectParent = async (
  messenger: Messenger,
  reportResult: ReportResult,
): Promise<Connection<RemoteMethods>> => {
  const additionCall = Promise.withResolvers<void>();
  const methods: ParentMethods = {
    add(left, right) {
      reportResult('add', left + right);
      additionCall.resolve();
      return left + right;
    },
  };
  const connection = connect<RemoteMethods>({
    messenger,
    methods,
  });
  const remote = await connection.promise;

  const multiplicationResult = await remote.multiply(2, 6);
  reportResult('multiply', multiplicationResult);

  const divisionResult = await remote.divide(12, 4);
  reportResult('divide', divisionResult);

  await additionCall.promise;
  return connection;
};

export const connectRemote = async (
  messenger: Messenger,
): Promise<Connection<ParentMethods>> => {
  const connection = connect<ParentMethods>({
    messenger,
    methods: createRemoteMethods(),
  });
  const parent = await connection.promise;
  await parent.add(2, 6);
  return connection;
};
