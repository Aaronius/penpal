import { CHILD_SERVER } from './constants.js';
import { waitForMessageFromSource, withTimeout } from './asyncUtils.js';
import {
  createIframeConnection,
  createWindowConnection,
} from './connectionManagementHelpers.js';
import type FixtureMethods from './fixtures/types/FixtureMethods.js';
import { CallOptions, PenpalError, Reply } from '../../src/index.js';
import { getPageFixtureUrl } from './utils.js';
import {
  isAck1Message,
  isAck2Message,
  isMessage,
  isSynMessage,
} from '../../src/guards.js';

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const allowInterruptedNavigation = (call: Promise<void>) =>
  call.catch((error: unknown) => {
    // The old page can navigate away before replying to this call.
    expect(error).toMatchObject({ code: 'TRANSMISSION_FAILED' });
  });

describe('connection management: reconnect', () => {
  it('reconnects after child reloads with a stateful allowed-origin regex', async () => {
    const { iframe, connection } = createIframeConnection<FixtureMethods>({
      allowedOrigins: [new RegExp(`^${escapeRegExp(CHILD_SERVER)}$`, 'g')],
    });
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

    await Promise.all([ackPromise, allowInterruptedNavigation(child.reload())]);

    await expect(child.multiply(2, 4)).resolves.toBe(8);
    connection.destroy();
  });

  it('reconnects after child navigates to a page with a different method set', async () => {
    const { iframe, connection } = createIframeConnection<FixtureMethods>();
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

    await Promise.all([
      ackPromise,
      allowInterruptedNavigation(
        child.navigate('/pages/methodNotInGeneralPage.html'),
      ),
    ]);

    await expect(child.methodNotInGeneralPage()).resolves.toBe('success');
    const pending = child.multiply(2, 4);
    await expect(pending).rejects.toBeInstanceOf(PenpalError);
    await expect(pending).rejects.toMatchObject({ code: 'METHOD_NOT_FOUND' });

    connection.destroy();
  });

  it('rejects method calls during reconnect with transmission error', async () => {
    const { iframe, connection } = createIframeConnection<FixtureMethods>();
    const child = await connection.promise;

    const synPromise = waitForMessageFromSource({
      source: iframe.contentWindow!,
      predicate(event) {
        return isMessage(event.data) && isSynMessage(event.data);
      },
      timeoutMessage: 'Timed out waiting for handshake SYN during reload',
    });

    await Promise.all([synPromise, allowInterruptedNavigation(child.reload())]);

    const pending = child.multiply(2, 4);
    await expect(pending).rejects.toBeInstanceOf(PenpalError);
    await expect(pending).rejects.toMatchObject({
      code: 'TRANSMISSION_FAILED',
    });
    await expect(pending).rejects.not.toHaveProperty(
      'message',
      expect.stringContaining("You've hit a bug in Penpal"),
    );

    connection.destroy();
  });

  it('rejects old calls and keeps their late replies off the new port', async () => {
    const started = Promise.withResolvers<void>();
    const lateReply = Promise.withResolvers<Reply<ArrayBuffer>>();
    const buffer = new ArrayBuffer(8);
    let waitForLateReply = true;
    const { iframe, connection } = createIframeConnection<FixtureMethods>({
      methods: {
        add(left: number, right: number) {
          if (waitForLateReply) {
            started.resolve();
            return lateReply.promise;
          }
          return left + right;
        },
      },
    });

    try {
      const child = await connection.promise;
      const oldCall = child.addUsingParent().catch((error: unknown) => error);
      await withTimeout(started.promise, 5000, 'The old call did not start');

      const ack = waitForMessageFromSource({
        source: iframe.contentWindow!,
        predicate: ({ data }) =>
          isMessage(data) && (isAck1Message(data) || isAck2Message(data)),
      });
      iframe.src = `${getPageFixtureUrl('general')}?reconnected`;
      await ack;

      await expect(
        withTimeout(oldCall, 5000, 'The old call was left pending'),
      ).resolves.toMatchObject({ code: 'TRANSMISSION_FAILED' });

      waitForLateReply = false;
      lateReply.resolve(new Reply(buffer, { transferables: [buffer] }));
      const options = new CallOptions({ timeout: 1000 });
      await child.addUsingParent(options);
      await expect(child.getParentReturnValue(options)).resolves.toBe(9);
      expect(buffer.byteLength).toBe(8);
    } finally {
      connection.destroy();
      lateReply.resolve(new Reply(buffer));
    }
  });

  it('keeps the same proxy when a cross-origin opened window navigates', async () => {
    const url = getPageFixtureUrl('openedWindow');
    const childWindow = window.open(url);
    if (!childWindow) {
      throw new Error('Could not open the fixture window');
    }

    const connection = createWindowConnection<{ getSearch(): string }>({
      remoteWindow: childWindow,
      allowedOrigins: [CHILD_SERVER],
      timeout: 5000,
    });

    try {
      const child = await connection.promise;
      const options = new CallOptions({ timeout: 1000 });
      await expect(child.getSearch(options)).resolves.toBe('');

      const ack = waitForMessageFromSource({
        source: childWindow,
        predicate: ({ data }) =>
          isMessage(data) && (isAck1Message(data) || isAck2Message(data)),
      });
      childWindow.location.href = `${url}?reconnected`;
      await ack;

      await expect(child.getSearch(options)).resolves.toBe('?reconnected');
    } finally {
      connection.destroy();
      childWindow.close();
    }
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
      CHILD_SERVER,
    );

    const resultEvent = await resultPromise;
    const payload = resultEvent.data;

    if (payload.type === 'RESULT') {
      throw new Error(
        `Expected parent call to fail after destroy, but it succeeded with value ${
          payload.result as number
        }`,
      );
    }

    expect(payload.code).toBe('CONNECTION_DESTROYED');
  });
});
