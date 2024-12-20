import ParentToIframeMessenger from './ParentToIframeMessenger';
import createLogger from '../createLogger';
import createDestructor from '../createDestructor';
import { Methods } from '../types';
import connectToChild from './connectToChild';

type Options = {
  /**
   * The iframe to which a connection should be made.
   */
  iframe: HTMLIFrameElement;
  /**
   * Methods that may be called by the iframe.
   */
  methods?: Methods;
  /**
   * The child origin to use to secure communication. If
   * not provided, the child origin will be derived from the
   * iframe's src or srcdoc value.
   */
  childOrigin?: string | RegExp;
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

const connectToChildIframe = <TMethods extends Methods = Methods>(
  options: Options
) => {
  const { iframe, methods, childOrigin, timeout, debug = false } = options;
  const log = createLogger(debug);
  const destructor = createDestructor('Parent', log);
  const messenger = new ParentToIframeMessenger(
    iframe,
    childOrigin,
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
