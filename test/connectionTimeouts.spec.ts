import { connect, PortMessenger } from '../src/index.js';
import { CHILD_SERVER } from './constants.js';
import { createIframeConnection } from './connectionManagementHelpers.js';
import {
  createWorkerAndConnection,
  expectConnectionToTimeout,
} from './utils.js';

describe('connection management: timeout behavior across messengers', () => {
  const timeout = 100;

  it('times out for non-responsive iframe targets', async () => {
    const { connection } = createIframeConnection({
      url: `${CHILD_SERVER}/never-respond`,
      timeout,
    });

    const error = await expectConnectionToTimeout(connection);
    expect(error.message).toBe(`Connection timed out after ${timeout}ms`);
  });

  it('times out for non-responsive worker targets', async () => {
    const connection = createWorkerAndConnection({
      workerName: 'neverRespondWorker',
      timeout,
    });

    const error = await expectConnectionToTimeout(connection);
    expect(error.message).toBe(`Connection timed out after ${timeout}ms`);
  });

  it('times out for message ports without a remote participant', async () => {
    const { port1 } = new MessageChannel();

    const connection = connect({
      messenger: new PortMessenger({
        port: port1,
      }),
      timeout,
    });

    const error = await expectConnectionToTimeout(connection);
    expect(error.message).toBe(`Connection timed out after ${timeout}ms`);
  });
});
