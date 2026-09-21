import { describe, expect, it } from 'vitest';
import { isValidApiKey } from '../src/lib/auth';

describe('isValidApiKey', () => {
  it('accepts the expected key', () => {
    expect(isValidApiKey('secret-key', 'secret-key')).toBe(true);
  });

  it('rejects a different key', () => {
    expect(isValidApiKey('other-key', 'secret-key')).toBe(false);
  });

  it('rejects a missing key', () => {
    expect(isValidApiKey(undefined, 'secret-key')).toBe(false);
  });
});
