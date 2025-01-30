import { Connection, Methods } from './types';
import { flattenMethods } from './methodSerialization';
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
};

/**
 * Attempts to establish communication with the remote.
 */
const connectToRemote = <TMethods extends Methods>({
  messenger,
  methods = {},
  timeout,
  localName,
}: Options & { localName: 'parent' | 'child' }): Connection<TMethods> => {
  if (!messenger) {
    throw new PenpalError(
      ErrorCode.InvalidArgument,
      'messenger must be defined'
    );
  }

  const flattenedMethods = flattenMethods(methods);
  const connectionClosedHandlers: (() => void)[] = [messenger.close];

  const callCloseHandlers = () => {
    for (const connectionClosedHandler of connectionClosedHandlers) {
      connectionClosedHandler();
    }
  };

  const promise = (async () => {
    try {
      const { remoteMethodProxies, close } = await shakeHands<TMethods>({
        messenger,
        flattenedMethods,
        initiate: localName === 'child',
        timeout,
      });
      connectionClosedHandlers.push(close);
      return remoteMethodProxies;
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
