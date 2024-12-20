import { Methods } from '../types';
import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import connectToParent from './connectToParent';
import WorkerToParentMessenger from './WorkerToParentMessenger';

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

const connectToParentFromWorker = <TMethods extends Methods = Methods>(
  options: Options
) => {
  const { methods, timeout, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Child', log);
  const messenger = new WorkerToParentMessenger(log, destructor);
  return connectToParent<TMethods>({
    messenger,
    methods,
    timeout,
    log,
    destructor,
  });
};

export default connectToParentFromWorker;
