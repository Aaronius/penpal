import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import { Methods } from '../types';
import connectToChild from './connectToChild';
import ParentToWorkerMessenger from './ParentToWorkerMessenger';

type Options = {
  /**
   * The worker to which a connection should be made.
   */
  worker: Worker;
  /**
   * Methods that may be called by the iframe.
   */
  methods?: Methods;
  /**
   * The amount of time, in milliseconds, Penpal should wait
   * for the iframe to respond before rejecting the connection promise.
   */
  timeout?: number;
  /**
   * The channel to use to restrict communication. When specified, a connection
   * will only be made when the child is connecting using the same channel.
   */
  channel?: string;
  /**
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

const connectToChildIframe = <TMethods extends Methods = Methods>(
  options: Options
) => {
  const { worker, methods, timeout, channel, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Parent', log);
  const messenger = new ParentToWorkerMessenger(
    worker,
    channel,
    log,
    destructor
  );
  return connectToChild<TMethods>({
    messenger,
    methods,
    timeout,
    log,
    destructor,
  });
};

export default connectToChildIframe;
