import { CHILD_SERVER } from './constants.js';
import {
  createIframeConnection,
  getRedirectPageUrl,
} from './connectionManagementHelpers.js';
import type FixtureMethods from './fixtures/types/FixtureMethods.js';
import { expectConnectionToTimeout } from './utils.js';

type ScenarioOptions = {
  allowedOrigins?: (string | RegExp)[];
  timeout?: number;
  fixturePage?: string;
  url?: string;
};

type Scenario = {
  name: string;
  shouldConnect: boolean;
  options?: ScenarioOptions;
};

describe('connection management: origins', () => {
  const defaultTimeoutMs = 100;

  const scenarios: Scenario[] = [
    {
      name: 'connects to window when correct origin is provided in parent',
      shouldConnect: true,
    },
    {
      name:
        'connects to window when correct origin regex is provided in parent',
      shouldConnect: true,
      options: {
        allowedOrigins: [/^http/],
      },
    },
    {
      name: 'connects to window when matching origin is provided in child',
      shouldConnect: true,
      options: {
        fixturePage: 'matchingParentOrigin',
        allowedOrigins: ['http://example.com', CHILD_SERVER],
      },
    },
    {
      name:
        'connects to window when matching origin regex is provided in child',
      shouldConnect: true,
      options: {
        fixturePage: 'matchingParentOriginRegex',
        allowedOrigins: ['http://example.com', CHILD_SERVER],
      },
    },
    {
      name:
        "doesn't connect to window when incorrect origin is provided in parent",
      shouldConnect: false,
      options: {
        allowedOrigins: ['http://example.com'],
      },
    },
    {
      name:
        "doesn't connect to window when mismatched origin is provided in child",
      shouldConnect: false,
      options: {
        fixturePage: 'mismatchedParentOrigin',
      },
    },
    {
      name:
        "doesn't connect to window when mismatched parent origin regex is provided in child",
      shouldConnect: false,
      options: {
        fixturePage: 'mismatchedParentOriginRegex',
      },
    },
    {
      name:
        'connects to window when child redirects to a different origin and parent allowedOrigins is *',
      shouldConnect: true,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: ['*'],
      },
    },
    {
      name:
        'connects to window when parent and child are same-origin and neither side sets allowed origins',
      shouldConnect: true,
      options: {
        url: '/pages/noParentOrigin.html',
        allowedOrigins: undefined,
      },
    },
    {
      name:
        "doesn't connect to window when child redirects to a different origin and parent omits allowed origins",
      shouldConnect: false,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: undefined,
      },
    },
    {
      name:
        "doesn't connect to window when child redirects to a different origin and parent sets a mismatched origin",
      shouldConnect: false,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: [CHILD_SERVER],
      },
    },
    {
      name:
        "doesn't connect to window when child redirects to a different origin and parent sets a mismatched origin regex",
      shouldConnect: false,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: [/example\.com/],
      },
    },
    {
      name: "doesn't connect to window when no origin is set in child",
      shouldConnect: false,
      options: {
        fixturePage: 'noParentOrigin',
        allowedOrigins: [CHILD_SERVER],
      },
    },
  ];

  for (const scenario of scenarios) {
    const { name, shouldConnect, options } = scenario;

    it(name, async () => {
      const timeout = shouldConnect
        ? options?.timeout
        : options?.timeout ?? defaultTimeoutMs;
      const hasAllowedOriginsOption = Object.prototype.hasOwnProperty.call(
        options ?? {},
        'allowedOrigins'
      );

      const { connection } = createIframeConnection<FixtureMethods>({
        ...(options?.fixturePage === undefined
          ? {}
          : { pageName: options.fixturePage }),
        ...(options?.url === undefined ? {} : { url: options.url }),
        ...(hasAllowedOriginsOption
          ? { allowedOrigins: options?.allowedOrigins }
          : {}),
        ...(timeout === undefined ? {} : { timeout }),
      });

      if (shouldConnect) {
        await connection.promise;
        connection.destroy();
        return;
      }

      await expectConnectionToTimeout(connection);
    });
  }
});
