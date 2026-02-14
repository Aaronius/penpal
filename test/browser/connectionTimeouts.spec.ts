import { connect, PortMessenger } from '../../src/index.js';
import { CHILD_SERVER } from './constants.js';
import { createIframeConnection } from './connectionManagementHelpers.js';
import {
  createWorkerAndConnection,
  expectConnectionToTimeout,
} from './utils.js';

describe('connection management: timeout behavior across messengers', () => {
  const timeoutMs = 100;

  const timeoutCases = [
    {
      name: 'times out for non-responsive iframe targets',
      createConnection(timeout) {
        return createIframeConnection({
          url: `${CHILD_SERVER}/never-respond`,
          timeout,
        }).connection;
      },
    },
    {
      name: 'times out for non-responsive worker targets',
      createConnection(timeout) {
        return createWorkerAndConnection({
          workerName: 'neverRespondWorker',
          timeout,
        });
      },
    },
    {
      name: 'times out for message ports without a remote participant',
      createConnection(timeout) {
        const { port1 } = new MessageChannel();

        return connect({
          messenger: new PortMessenger({
            port: port1,
          }),
          timeout,
        });
      },
    },
  ];

  for (const timeoutCase of timeoutCases) {
    const { name, createConnection } = timeoutCase;

    it(name, async () => {
      const connection = createConnection(timeoutMs);
      const error = await expectConnectionToTimeout(connection);
      expect(error.message).toBe(`Connection timed out after ${timeoutMs}ms`);
    });
  }
});
