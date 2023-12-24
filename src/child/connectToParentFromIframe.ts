import { Methods } from '../types';
import IframeToParentAdapter from '../IframeToParentAdapter';
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
   * Whether log messages should be emitted to the console.
   */
  debug?: boolean;
};

const connectToParentFromIframe = (options: Options) => {
  const { parentOrigin, methods, timeout, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Child', log);
  const commsAdapter = new IframeToParentAdapter(parentOrigin, log, destructor);
  return connectToParent({
    commsAdapter,
    methods,
    timeout,
    log,
    destructor,
  });
};

export default connectToParentFromIframe;
