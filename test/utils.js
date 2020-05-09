export const createAndAddIframe = (url) => {
  const iframe = document.createElement('iframe');
  iframe.src = url;
  document.body.appendChild(iframe);
  return iframe;
};
