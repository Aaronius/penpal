import type { UnspecifiedRemoteMethods } from '../../../src/types.js';
import type {
  Connection,
  MethodsShape,
  RemoteProxy,
} from '../../../src/index.js';

type ConnectionOptions = {
  methods?: object;
  timeout?: number;
};

export type CreateConnection<
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
> = (options?: ConnectionOptions) => Connection<TRemoteMethods>;

export const withConnection = async <
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
>(
  createConnection: CreateConnection<TRemoteMethods>,
  fn: (
    child: RemoteProxy<TRemoteMethods>,
    connection: Connection<TRemoteMethods>,
  ) => Promise<void> | void,
  options?: ConnectionOptions,
) => {
  const connection = createConnection(options);

  try {
    const child = await connection.promise;
    await fn(child, connection);
  } finally {
    connection.destroy();
  }
};
