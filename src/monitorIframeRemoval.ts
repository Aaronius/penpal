import { Destructor } from './createDestructor';

const CHECK_IFRAME_IN_DOC_INTERVAL = 60000;

export default (iframe: HTMLIFrameElement, destructor: Destructor) => {
  const { destroy, onDestroy } = destructor;

  // This is to prevent memory leaks when the iframe is removed
  // from the document and the consumer hasn't called destroy().
  // Without this, event listeners attached to the window would
  // stick around and since the event handlers have a reference
  // to the iframe in their closures, the iframe would stick around
  // too.
  var checkIframeInDocIntervalId = setInterval(() => {
    if (!document.contains(iframe)) {
      clearInterval(checkIframeInDocIntervalId);
      destroy();
    }
  }, CHECK_IFRAME_IN_DOC_INTERVAL);

  onDestroy(() => {
    clearInterval(checkIframeInDocIntervalId);
  })
}
