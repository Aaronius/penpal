import { connect, WindowMessenger } from '../../src/index.js';
import type { Methods } from '../../src/index.js';
import { CHILD_SERVER } from '../constants.js';
import { createAndAddIframe } from '../utils.js';

type CreateBackwardCompatibilityIframeAndConnectionOptions = {
  path?: string;
  url?: string;
  allowedOrigins?: (string | RegExp)[];
  methods?: Methods;
  timeout?: number;
};

const getBackwardCompatibilityPageUrl = (path = 'general.html') => {
  return `${CHILD_SERVER}/pages/backwardCompatibility/${path}`;
};

export const createBackwardCompatibilityIframeAndConnection = <
  TMethods extends Methods
>({
  path = 'general.html',
  url,
  allowedOrigins = [CHILD_SERVER],
  methods,
  timeout,
}: CreateBackwardCompatibilityIframeAndConnectionOptions = {}) => {
  const iframe = createAndAddIframe(
    url ?? getBackwardCompatibilityPageUrl(path)
  );

  const messenger = new WindowMessenger({
    remoteWindow: iframe.contentWindow!,
    ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
  });

  const connection = connect<TMethods>({
    messenger,
    ...(methods === undefined ? {} : { methods }),
    ...(timeout === undefined ? {} : { timeout }),
  });

  return { iframe, connection };
};
