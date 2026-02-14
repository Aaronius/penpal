import type { Connection, Methods, RemoteProxy } from '../../../src/index.js';

type ConnectionOptions = {
  methods?: Methods;
  timeout?: number;
};

export type CreateConnection<TMethods extends Methods> = (
  options?: ConnectionOptions
) => Connection<TMethods>;

export const withConnection = async <TMethods extends Methods>(
  createConnection: CreateConnection<TMethods>,
  fn: (
    child: RemoteProxy<TMethods>,
    connection: Connection<TMethods>
  ) => Promise<void> | void,
  options?: ConnectionOptions
) => {
  const connection = createConnection(options);

  try {
    const child = await connection.promise;
    await fn(child, connection);
  } finally {
    connection.destroy();
  }
};
