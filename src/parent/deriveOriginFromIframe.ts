import { Log } from '../types';

const UNABLE_TO_DERIVE_VALID_ORIGIN_MESSAGE = `Unable to derive a valid origin from the iframe. Falling back to origin "${window.origin}".`;

export default (iframe: HTMLIFrameElement, log: Log): string => {
  const { src } = iframe;

  try {
    /*
    This line will throw an error if src is undefined (which legitimately might
    be the case if the consumer is using srcdoc or just hasn't set src yet),
    a relative path, or otherwise an invalid URL.
    */
    const origin = new URL(src).origin;

    /*
    In certain cases, like if `src` starts with `data:`, the value of `origin`
    will be 'null' because the browser considers a data URL to be an
    "opaque origin". However, when using a value of 'null' as a target
    origin in postMessage, postMessage will throw an error saying that 'null'
    is an invalid target origin. The typical way to work through this is for
    the consumer to either host the data on a web server somewhere or to specify
    a childOrigin of *. We don't want to automatically use a childOrigin of *
    on behalf of the consumer, because it involves some level of risk that the
    consumer should consider.
    */
    if (origin === 'null') {
      log(UNABLE_TO_DERIVE_VALID_ORIGIN_MESSAGE);
      return window.origin;
    }

    log(`Using derived child origin of "${origin}".`);
    return origin;
  } catch (_) {
    log(UNABLE_TO_DERIVE_VALID_ORIGIN_MESSAGE);
    return window.origin;
  }
};
