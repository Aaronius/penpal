import { describe, expect, it } from 'vitest';
import {
  serializeError,
  deserializeError,
} from '../../src/errorSerialization.js';
import PenpalError from '../../src/PenpalError.js';

describe('error serialization', () => {
  it('round-trips a standard Error', () => {
    const originalError = new TypeError('Boom');
    originalError.stack = 'test-stack';

    const serialized = serializeError(originalError);
    const deserialized = deserializeError(serialized);

    expect(deserialized).toEqual(expect.any(Error));
    expect(deserialized.name).toBe('TypeError');
    expect(deserialized.message).toBe('Boom');
    expect(deserialized.stack).toBe('test-stack');
  });

  it('round-trips a PenpalError including code', () => {
    const originalError = new PenpalError('METHOD_NOT_FOUND', 'Missing method');
    originalError.stack = 'penpal-stack';

    const serialized = serializeError(originalError);
    const deserialized = deserializeError(serialized);

    expect(deserialized).toEqual(expect.any(PenpalError));
    expect((deserialized as PenpalError).code).toBe('METHOD_NOT_FOUND');
    expect(deserialized.message).toBe('Missing method');
    expect(deserialized.stack).toBe('penpal-stack');
  });
});
