import { CHILD_SERVER } from './constants.js';
import { waitForMessageFromSource } from './asyncUtils.js';
import { createIframeConnection } from './connectionManagementHelpers.js';
import { PenpalError } from '../../src/index.js';
import {
  isAck1Message,
  isAck2Message,
  isMessage,
  isSynMessage,
} from '../../src/guards.js';

describe('connection management: reconnect', () => {
  it('reconnects after child reloads', async () => {
    const { iframe, connection } = createIframeConnection();
    const child = await connection.promise;

    const ackPromise = waitForMessageFromSource({
      source: iframe.contentWindow!,
      predicate(event) {
        return (
          isMessage(event.data) &&
          (isAck1Message(event.data) || isAck2Message(event.data))
        );
      },
      timeoutMessage: 'Timed out waiting for handshake ACK after reload',
    });

    void child.reload();
    await ackPromise;

    await expect(child.multiply(2, 4)).resolves.toBe(8);
    connection.destroy();
  });

  it('reconnects after child navigates to a page with a different method set', async () => {
    const { iframe, connection } = createIframeConnection();
    const child = await connection.promise;

    const ackPromise = waitForMessageFromSource({
      source: iframe.contentWindow!,
      predicate(event) {
        return (
          isMessage(event.data) &&
          (isAck1Message(event.data) || isAck2Message(event.data))
        );
      },
      timeoutMessage: 'Timed out waiting for handshake ACK after navigation',
    });

    void child.navigate('/pages/methodNotInGeneralPage.html');
    await ackPromise;

    await expect(child.methodNotInGeneralPage()).resolves.toBe('success');
    await expect(child.multiply(2, 4)).rejects.toMatchObject({
      code: 'METHOD_NOT_FOUND',
    });

    connection.destroy();
  });

  it('rejects method calls during reconnect with transmission error', async () => {
    const { iframe, connection } = createIframeConnection();
    const child = await connection.promise;

    const synPromise = waitForMessageFromSource({
      source: iframe.contentWindow!,
      predicate(event) {
        return isMessage(event.data) && isSynMessage(event.data);
      },
      timeoutMessage: 'Timed out waiting for handshake SYN during reload',
    });

    void child.reload();
    await synPromise;

    const result = await child.multiply(2, 4).then(
      (value) => value,
      (error) => error
    );

    expect(result).toEqual(expect.any(PenpalError));
    expect((result as PenpalError).code).toBe('TRANSMISSION_FAILED');
    expect((result as Error).message).not.toContain(
      "You've hit a bug in Penpal"
    );

    connection.destroy();
  });

  it('destroys the remote side when the parent destroys the connection', async () => {
    const { iframe, connection } = createIframeConnection({
      pageName: 'connectionDestroyedProbe',
      methods: {
        add(num1: number, num2: number) {
          return num1 + num2;
        },
      },
    });

    await connection.promise;
    connection.destroy();

    const resultPromise = waitForMessageFromSource<{
      fixture?: string;
      type?: string;
      result?: number;
      code?: string;
    }>({
      source: iframe.contentWindow!,
      predicate(event) {
        const payload = event.data;
        return (
          !!payload &&
          typeof payload === 'object' &&
          payload.fixture === 'connectionDestroyedProbe' &&
          (payload.type === 'RESULT' || payload.type === 'RESULT_ERROR')
        );
      },
      timeoutMessage: 'Timed out waiting for connection-destroyed probe result',
    });

    iframe.contentWindow!.postMessage(
      {
        fixture: 'connectionDestroyedProbe',
        type: 'REQUEST_ADD_USING_PARENT',
      },
      CHILD_SERVER
    );

    const resultEvent = await resultPromise;
    const payload = resultEvent.data;

    if (payload.type === 'RESULT') {
      throw new Error(
        `Expected parent call to fail after destroy, but it succeeded with value ${
          payload.result as number
        }`
      );
    }

    expect(payload.code).toBe('CONNECTION_DESTROYED');
  });
});
