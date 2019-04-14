const DEFAULT_PORTS = {
  'http:': '80',
  'https:': '443'
};

const URL_REGEX = /^(https?:|file:)?\/\/([^/:]+)?(:(\d+))?/;

const opaqueOriginSchemes = ['file:', 'data:'];

/**
 * Converts a src value into an origin.
 * @param {string} src
 * @return {string} The URL's origin
 */
export default src => {
  if (src && opaqueOriginSchemes.find(scheme => src.startsWith(scheme))) {
    // The origin of the child document is an opaque origin and its
    // serialization is "null"
    // https://html.spec.whatwg.org/multipage/origin.html#origin
    return 'null';
  }

  // Note that if src is undefined, then srcdoc is being used instead of src
  // and we can follow this same logic below to get the origin of the parent,
  // which is the origin that we will need to use.

  const location = document.location;

  const regexResult = URL_REGEX.exec(src);
  let protocol;
  let hostname;
  let port;

  if (regexResult) {
    // It's an absolute URL. Use the parsed info.
    // regexResult[1] will be undefined if the URL starts with //
    protocol = regexResult[1] ? regexResult[1] : location.protocol;
    hostname = regexResult[2];
    port = regexResult[4];
  } else {
    // It's a relative path. Use the current location's info.
    protocol = location.protocol;
    hostname = location.hostname;
    port = location.port;
  }

  // If the protocol is file, the origin is "null"
  // The origin of a document with file protocol is an opaque origin
  // and its serialization "null" [1]
  // [1] https://html.spec.whatwg.org/multipage/origin.html#origin
  // if (protocol === 'file:') {
  //   return 'null';
  // }

  // If the port is the default for the protocol, we don't want to add it to the origin string
  // or it won't match the message's event.origin.
  const portSuffix = port && port !== DEFAULT_PORTS[protocol] ? `:${port}` : '';
  return `${protocol}//${hostname}${portSuffix}`;
};
