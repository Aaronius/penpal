import { CHILD_SERVER } from '../constants.js';
import { getAlternateFixtureOrigin } from '../connectionManagementHelpers.js';
import type FixtureMethods from '../fixtures/types/FixtureMethods.js';
import { expectConnectionToTimeout } from '../utils.js';
import { createBackwardCompatibilityIframeAndConnection } from './utils.js';

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

const getRedirectToUrl = () => {
  return encodeURIComponent(
    `${getAlternateFixtureOrigin()}/pages/backwardCompatibility/general.html`
  );
};

const getRedirectPageUrl = () => {
  return `${CHILD_SERVER}/pages/backwardCompatibility/redirect.html?to=${getRedirectToUrl()}`;
};

describe('BACKWARD COMPATIBILITY: connection management origins', () => {
  const defaultTimeoutMs = 100;

  const scenarios: Scenario[] = [
    {
      name: 'connects to iframe when correct child origin is provided',
      shouldConnect: true,
    },
    {
      name: 'connects to iframe when correct child origin regex is provided',
      shouldConnect: true,
      options: {
        allowedOrigins: [/^http/],
      },
    },
    {
      name:
        'connects to iframe when child connects to parent with matching origin',
      shouldConnect: true,
      options: {
        fixturePage: 'matchingParentOrigin',
      },
    },
    {
      name:
        'connects to iframe when child connects to parent with matching origin regex',
      shouldConnect: true,
      options: {
        fixturePage: 'matchingParentOriginRegex',
      },
    },
    {
      name: "doesn't connect to iframe when incorrect child origin is provided",
      shouldConnect: false,
      options: {
        allowedOrigins: ['http://bogus.com'],
      },
    },
    {
      name:
        "doesn't connect to iframe when child connects to mismatched parent origin",
      shouldConnect: false,
      options: {
        fixturePage: 'mismatchedParentOrigin',
      },
    },
    {
      name:
        "doesn't connect to iframe when child connects to mismatched parent origin regex",
      shouldConnect: false,
      options: {
        fixturePage: 'mismatchedParentOriginRegex',
      },
    },
    {
      name:
        'connects to iframe when child redirects to a different origin and child origin is *',
      shouldConnect: true,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: ['*'],
      },
    },
    {
      name:
        "doesn't connect to iframe when child redirects to a different origin and child origin is omitted",
      shouldConnect: false,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: undefined,
      },
    },
    {
      name:
        "doesn't connect to iframe when child redirects to a different origin and child origin is mismatched",
      shouldConnect: false,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: [CHILD_SERVER],
      },
    },
    {
      name:
        "doesn't connect to iframe when child redirects to a different origin and child origin regex is mismatched",
      shouldConnect: false,
      options: {
        url: getRedirectPageUrl(),
        allowedOrigins: [/example\.com/],
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

      const { connection } = createBackwardCompatibilityIframeAndConnection<
        FixtureMethods
      >({
        ...(options?.fixturePage === undefined
          ? {}
          : { path: `${options.fixturePage}.html` }),
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
