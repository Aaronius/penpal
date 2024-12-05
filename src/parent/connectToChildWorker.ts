import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import { Methods } from '../types';
import connectToChild from './connectToChild';
import ParentToWorkerAdapter from './ParentToWorkerAdapter';

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
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

const connectToChildIframe = (options: Options) => {
  const { worker, methods, timeout, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Parent', log);
  const commsAdapter = new ParentToWorkerAdapter(worker, log, destructor);
  return connectToChild({
    commsAdapter,
    methods,
    timeout,
    log,
    destructor,
  });
};

export default connectToChildIframe;
