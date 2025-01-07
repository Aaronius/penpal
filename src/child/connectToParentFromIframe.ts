import { Methods } from '../types';
import IframeToParentMessenger from './IframeToParentMessenger';
import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import connectToParent from './connectToParent';

type Options = {
  /**
   * Valid parent origin used to restrict communication.
   */
  parentOrigin: string | RegExp;
  /**
   * Methods that may be called by the parent window.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the parent to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * The channel to use to restrict communication. When specified, a connection
   * will only be made when the parent is connecting using the same channel.
   */
  channel?: string;
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

const connectToParentFromIframe = <TMethods extends Methods = Methods>(
  options: Options
) => {
  const { parentOrigin, methods, timeout, channel, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Child', log);
  const messenger = new IframeToParentMessenger(
    parentOrigin,
    channel,
    log,
    destructor
  );
  return connectToParent<TMethods>({
    messenger,
    methods,
    timeout,
    channel,
    log,
    destructor,
  });
};

export default connectToParentFromIframe;
