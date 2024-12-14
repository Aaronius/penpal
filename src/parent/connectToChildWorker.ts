import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import { CallSender, Methods } from '../types';
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
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

const connectToChildIframe = <TCallSender extends object = CallSender>(
  options: Options
) => {
  const { worker, methods, timeout, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Parent', log);
  const messenger = new ParentToWorkerMessenger(worker, log, destructor);
  return connectToChild<TCallSender>({
    messenger,
    methods,
    timeout,
    log,
    destructor,
  });
};

export default connectToChildIframe;
