import { describe, expect, it } from 'vitest';
import {
  downgradeMessage,
  isDeprecatedMessage,
  upgradeMessage,
} from '../../src/backwardCompatibility.js';
import PenpalError from '../../src/PenpalError.js';
import namespace from '../../src/namespace.js';

describe('backward compatibility message translation', () => {
  it('upgrades deprecated SYN to modern SYN', () => {
    const upgraded = upgradeMessage({
      penpal: 'syn',
    });

    expect(upgraded).toEqual({
      namespace,
      channel: undefined,
      type: 'SYN',
      participantId: 'deprecated-penpal',
    });
  });

  it('downgrades ACK1 to deprecated synAck', () => {
    const downgraded = downgradeMessage({
      namespace,
      channel: undefined,
      type: 'ACK1',
      methodPaths: [['nested', 'method']],
    });

    expect(downgraded).toEqual({
      penpal: 'synAck',
      methodNames: ['nested.method'],
    });
  });

  it('throws transmission error for unsupported message shape', () => {
    expect(() => {
      upgradeMessage({
        penpal: 'unsupported' as 'syn',
      });
    }).toThrowError(PenpalError);

    try {
      upgradeMessage({
        penpal: 'unsupported' as 'syn',
      });
    } catch (error) {
      expect((error as PenpalError).code).toBe('TRANSMISSION_FAILED');
    }
  });

  it('detects deprecated message payloads', () => {
    expect(isDeprecatedMessage({ penpal: 'ack' })).toBe(true);
    expect(isDeprecatedMessage({ namespace, type: 'SYN' })).toBe(false);
  });
});
