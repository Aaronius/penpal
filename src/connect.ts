import type {
  DestroyMessage,
  Connection,
  Log,
  Message,
  MethodsShape,
  UnspecifiedRemoteMethods,
  RemoteProxy,
} from './types.js';
import PenpalError from './PenpalError.js';
import type Messenger from './messengers/Messenger.js';
import createHandshake from './createHandshake.js';
import type { HandshakeMessage } from './createHandshake.js';
import connectCallHandler from './connectCallHandler.js';
import type { CallHandler } from './connectCallHandler.js';
import connectRemoteProxy from './connectRemoteProxy.js';
import type { RemoteProxyController } from './connectRemoteProxy.js';
import { isMessage } from './guards.js';
import scheduleTimeout from './scheduleTimeout.js';
import namespace from './namespace.js';

type ConnectOptions = {
  /**
   * Messenger in charge of handling communication with the remote.
   */
  messenger: Messenger;
  /**
   * Methods that may be called by the remote.
   */
  methods?: object | undefined;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for a connection to be established before rejecting the connection promise.
   */
  timeout?: number | undefined;
  /**
   * A string identifier that disambiguates communication when establishing
   * multiple, parallel connections between two participants (e.g., two windows,
   * a window and a worker).
   */
  channel?: string | undefined;
  /**
   * A function for logging debug messages. Debug messages will only be
   * logged when this is defined.
   */
  log?: Log | undefined;
};

const usedMessengers = new WeakSet<Messenger>();

const getConnectionDestroyedError = () => {
  return new PenpalError('CONNECTION_DESTROYED', 'Connection destroyed');
};

/**
 * Attempts to establish communication with the remote.
 */
const connect = <
  TRemoteMethods extends
    | MethodsShape<TRemoteMethods>
    | UnspecifiedRemoteMethods = UnspecifiedRemoteMethods,
>({
  messenger,
  methods = {},
  timeout,
  channel,
  log,
}: ConnectOptions): Connection<TRemoteMethods> => {
  if (!messenger) {
    throw new PenpalError('INVALID_ARGUMENT', 'messenger must be defined');
  }

  if (usedMessengers.has(messenger)) {
    throw new PenpalError(
      'INVALID_ARGUMENT',
      'A messenger can only be used for a single connection',
    );
  }

  usedMessengers.add(messenger);

  const connectionPromise =
    Promise.withResolvers<RemoteProxy<TRemoteMethods>>();
  let isConnectionDestroyed = false;
  let hasStartedInitializingMessenger = false;
  let cancelConnectionTimeout: (() => void) | undefined;
  let callHandler: CallHandler | undefined;
  let remoteProxyController: RemoteProxyController<TRemoteMethods> | undefined;

  const sendDestroyMessage = () => {
    const destroyMessage: DestroyMessage = {
      namespace,
      channel,
      type: 'DESTROY',
    };

    try {
      messenger.sendMessage(destroyMessage);
    } catch (_) {
      // A messenger may be unable to send DESTROY before the handshake
      // sets up its message port. Finish closing our side either way.
    }
  };

  const destroyConnection = (
    reason: PenpalError,
    notifyOtherParticipant: boolean,
  ) => {
    if (isConnectionDestroyed) {
      return;
    }

    // Sending DESTROY can cause a custom messenger to call onDisconnect(),
    // which calls destroyConnection() again. Set the flag first so cleanup
    // only runs once.
    isConnectionDestroyed = true;

    cancelConnectionTimeout?.();
    // Skip messenger cleanup if startup fails before initialize() starts.
    // An uninitialized messenger could throw during cleanup and hide the
    // original error.
    if (hasStartedInitializingMessenger) {
      if (notifyOtherParticipant) {
        sendDestroyMessage();
      }
      messenger.destroy();
    }
    callHandler?.destroy();
    remoteProxyController?.destroy();
    connectionPromise.reject(reason);

    log?.('Connection destroyed');
  };

  const destroyConnectionLocally = () => {
    // The remote already sent DESTROY or the messenger can no longer reach it.
    destroyConnection(getConnectionDestroyedError(), false);
  };

  // Return true when the messenger sends without throwing. Return false if
  // the connection is already closed or the send fails, so the handshake
  // can stop instead of sending the next message or reporting completion.
  const sendHandshakeMessage = (message: HandshakeMessage) => {
    if (isConnectionDestroyed) {
      return false;
    }

    log?.(`Sending handshake ${message.type}`, message);

    try {
      messenger.sendMessage(message);
      return true;
    } catch (error) {
      // If a reconnect fails after connection.promise has resolved,
      // rejecting the promise has no effect. Close the connection to
      // release the messenger.
      destroyConnection(
        new PenpalError('TRANSMISSION_FAILED', (error as Error).message),
        true,
      );
      return false;
    }
  };

  /**
   * When the remote side calls connect() again, its first handshake message
   * carries a new ID. This can happen after an iframe or opened window
   * reloads. Clear the old remote's call state so the app can keep using
   * the same proxy once the new handshake finishes.
   * This also runs on the first handshake, when there is no previous remote
   * to clean up.
   */
  const retirePreviousParticipant = () => {
    // A local method called by the previous remote may still be running.
    // Disable its handler so any late reply can't reach the new remote.
    callHandler?.destroy();
    callHandler = undefined;

    // Reject any calls we sent to the previous remote that are still waiting
    // for a reply. The new remote never received them.
    remoteProxyController?.rejectCallsOnReconnect();
  };

  const completeHandshake = () => {
    // We create a call handler when a handshake finishes, so an existing
    // handler means we've already completed this handshake.
    // retirePreviousParticipant() clears it when the remote reconnects.
    if (isConnectionDestroyed || callHandler) {
      return;
    }

    callHandler = connectCallHandler(messenger, methods, channel, log);

    // The app may have saved the proxy from the first handshake. Keep using
    // it when the remote reconnects so the app can keep making calls.
    if (remoteProxyController) {
      return;
    }

    const controller = connectRemoteProxy<TRemoteMethods>(
      messenger,
      channel,
      log,
    );
    remoteProxyController = controller;
    cancelConnectionTimeout?.();
    cancelConnectionTimeout = undefined;

    // The call handler can now run methods requested by the remote, and the
    // proxy controller can match incoming replies to the app's pending calls.
    // Resolve connection.promise after the messenger returns from delivering
    // the final handshake message. If the messenger calls onDisconnect()
    // before returning, teardown can reject the promise first.
    void Promise.resolve().then(() => {
      connectionPromise.resolve(controller.remoteProxy);
    });
  };

  try {
    cancelConnectionTimeout = scheduleTimeout(() => {
      destroyConnection(
        new PenpalError(
          'CONNECTION_TIMEOUT',
          `Connection timed out after ${timeout}ms`,
        ),
        true,
      );
    }, timeout);

    const handshake = createHandshake({
      channel,
      sendMessage: sendHandshakeMessage,
      onNewParticipant: retirePreviousParticipant,
      onComplete: completeHandshake,
    });

    // initialize() can call onDisconnect() or throw after attaching listeners.
    // Enable messenger cleanup before calling it so either path can remove them.
    hasStartedInitializingMessenger = true;
    messenger.initialize({
      log,
      validateReceivedMessage: (data): data is Message =>
        isMessage(data) && data.channel === channel,
      onDisconnect: destroyConnectionLocally,
      onMessage: (message) => {
        if (isConnectionDestroyed) {
          return;
        }

        switch (message.type) {
          case 'DESTROY':
            destroyConnectionLocally();
            break;
          case 'SYN':
          case 'ACK1':
          case 'ACK2':
            log?.(`Received handshake ${message.type}`, message);
            handshake.handleMessage(message);
            break;
          case 'CALL':
            // Ignore incoming calls until the handshake creates a handler.
            callHandler?.handleMessage(message);
            break;
          case 'REPLY':
            remoteProxyController?.handleMessage(message);
            break;
        }
      },
    });

    // initialize() can call onDisconnect(), which closes the connection
    // before initialize() returns. Start the handshake only if it's open.
    if (!isConnectionDestroyed) {
      handshake.start();
    }
  } catch (error) {
    destroyConnection(error as PenpalError, true);
  }

  return {
    promise: connectionPromise.promise,
    destroy: () => {
      destroyConnection(getConnectionDestroyedError(), true);
    },
  };
};

export default connect;
