import { Methods } from '../types';
import IframeToParentAdapter from './IframeToParentAdapter';
import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import connectToParent from './connectToParent';
import WorkerToParentAdapter from './WorkerToParentAdapter';

type Options = {
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
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

const connectToParentFromWorker = (options: Options) => {
  const { methods, timeout, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Child', log);
  const commsAdapter = new WorkerToParentAdapter(log, destructor);
  return connectToParent({
    commsAdapter,
    methods,
    timeout,
    log,
    destructor,
  });
};

export default connectToParentFromWorker;
