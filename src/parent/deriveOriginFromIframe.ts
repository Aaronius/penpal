export default (iframe: HTMLIFrameElement): string => {
  const { src } = iframe;
  try {
    // This will throw an error if src is undefined (which legitimately might
    // be the case if the consumer is using srcdoc or just hasn't set src yet),
    // a relative path, or otherwise an invalid URL, in which case we'll fall
    // back to the current page's origin.
    return new URL(src).origin;
  } catch (_) {
    return window.origin;
  }
};
