import { Connection, Log, Methods } from './types';
import PenpalError from './PenpalError';
import Messenger from './Messenger';
import { ErrorCode } from './enums';
import shakeHands from './shakeHands';

type Options = {
  /**
   * Messenger in charge of handling communication with the remote.
   */
  messenger: Messenger;
  /**
   * Methods that may be called by the remote.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the remote to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * A function for logging debug messages. Debug messages will only be
   * logged when this is defined.
   */
  log?: Log;
};

/**
 * Attempts to establish communication with the remote.
 */
const connectToRemote = <TMethods extends Methods>({
  messenger,
  methods = {},
  timeout,
  log,
  localName,
}: Options & { localName: 'parent' | 'child' }): Connection<TMethods> => {
  if (!messenger) {
    throw new PenpalError(
      ErrorCode.InvalidArgument,
      'messenger must be defined'
    );
  }

  const connectionClosedHandlers: (() => void)[] = [messenger.close];

  const callCloseHandlers = () => {
    for (const connectionClosedHandler of connectionClosedHandlers) {
      connectionClosedHandler();
    }
  };

  const promise = (async () => {
    try {
      messenger.initialize({ log });
      const { remoteProxy, close } = await shakeHands<TMethods>({
        messenger,
        methods,
        initiate: localName === 'child',
        timeout,
        log,
      });
      connectionClosedHandlers.push(close);
      return remoteProxy;
    } catch (error) {
      callCloseHandlers();
      throw error as PenpalError;
    }
  })();

  return {
    promise,
    close() {
      // Why we don't reject the connection promise in this case:
      // https://github.com/Aaronius/penpal/issues/51
      callCloseHandlers();
      log?.('Connection closed');
    },
  };
};

export const connectToChild = <TMethods extends Methods = Methods>(
  options: Options
) => {
  return connectToRemote<TMethods>({
    ...options,
    localName: 'parent',
  });
};

export const connectToParent = <TMethods extends Methods = Methods>(
  options: Options
) => {
  return connectToRemote<TMethods>({
    ...options,
    localName: 'child',
  });
};
