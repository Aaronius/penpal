import { CHILD_SERVER } from './constants.js';
import { createAndAddIframe, getPageFixtureUrl } from './utils.js';
import { connect, WindowMessenger } from '../src/index.js';
import type { Methods, RemoteProxy } from '../src/index.js';
import type FixtureMethods from './childFixtures/types/FixtureMethods.js';

type CreateWindowConnectionOptions = {
  remoteWindow: Window;
  allowedOrigins?: (string | RegExp)[];
  methods?: Methods;
  timeout?: number;
  channel?: string;
};

type CreateIframeConnectionOptions = Omit<
  CreateWindowConnectionOptions,
  'remoteWindow'
> & {
  pageName?: string;
  url?: string;
};

type ChannelChildMethods = Pick<
  FixtureMethods,
  'getChannel' | 'getChannelFromParent'
>;

export const createWindowConnection = <TMethods extends Methods>({
  remoteWindow,
  allowedOrigins,
  methods,
  timeout,
  channel,
}: CreateWindowConnectionOptions) => {
  const messenger = new WindowMessenger({
    remoteWindow,
    ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
  });

  return connect<TMethods>({
    messenger,
    ...(methods === undefined ? {} : { methods }),
    ...(timeout === undefined ? {} : { timeout }),
    ...(channel === undefined ? {} : { channel }),
  });
};

export const createIframeConnection = <TMethods extends Methods>({
  ...options
}: CreateIframeConnectionOptions = {}) => {
  const { pageName = 'general', url, methods, timeout, channel } = options;
  const hasAllowedOriginsOption = Object.prototype.hasOwnProperty.call(
    options,
    'allowedOrigins'
  );
  const allowedOrigins = hasAllowedOriginsOption
    ? options.allowedOrigins
    : [CHILD_SERVER];

  const iframe = createAndAddIframe(url ?? getPageFixtureUrl(pageName));

  const connection = createWindowConnection<TMethods>({
    remoteWindow: iframe.contentWindow!,
    ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
    ...(methods === undefined ? {} : { methods }),
    ...(timeout === undefined ? {} : { timeout }),
    ...(channel === undefined ? {} : { channel }),
  });

  return { iframe, connection };
};

export const getAlternateFixtureOrigin = () => {
  const url = new URL(CHILD_SERVER);
  url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  return url.origin;
};

export const getRedirectPageUrl = () => {
  const redirectToUrl = encodeURIComponent(
    getPageFixtureUrl('general', getAlternateFixtureOrigin())
  );
  return `${getPageFixtureUrl('redirect')}?to=${redirectToUrl}`;
};

export const expectParallelChannelResults = async (
  channelAChild: RemoteProxy<ChannelChildMethods>,
  channelBChild: RemoteProxy<ChannelChildMethods>
) => {
  const results = await Promise.all([
    channelAChild.getChannel(),
    channelBChild.getChannel(),
    channelAChild.getChannelFromParent(),
    channelBChild.getChannelFromParent(),
  ]);

  expect(results).toEqual(['A', 'B', 'A', 'B']);
};
