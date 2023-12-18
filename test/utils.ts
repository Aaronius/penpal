export const createAndAddIframe = (url?: string) => {
  const iframe = document.createElement('iframe');
  if (url) {
    iframe.src = url;
  }
  document.body.appendChild(iframe);
  return iframe;
};
