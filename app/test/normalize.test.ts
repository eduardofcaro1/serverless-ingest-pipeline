import { describe, expect, it } from 'vitest';
import { normalize } from '../src/core/normalize';
import { readingSchema } from '../src/core/schema';
import { validReading } from './helpers';

function parse(overrides: Record<string, unknown>) {
  return readingSchema.parse(validReading(overrides));
}

describe('normalize', () => {
  it('converts fahrenheit to celsius', () => {
    const result = normalize(parse({ value: 98.6, unit: 'F' }));
    expect(result.value).toBe(37);
    expect(result.unit).toBe('C');
  });

  it('converts kelvin to celsius', () => {
    const result = normalize(parse({ value: 300, unit: 'K' }));
    expect(result.value).toBe(26.85);
    expect(result.unit).toBe('C');
  });

  it('converts kPa to hPa', () => {
    const result = normalize(parse({ metric: 'pressure', value: 101.3, unit: 'kPa' }));
    expect(result.value).toBe(1013);
    expect(result.unit).toBe('hPa');
  });

  it('keeps values that are already canonical', () => {
    const result = normalize(parse({ value: 21.5, unit: 'C' }));
    expect(result.value).toBe(21.5);
    expect(result.unit).toBe('C');
  });

  it('normalizes the timestamp to UTC', () => {
    const result = normalize(parse({ recordedAt: '2026-01-15T07:30:00-03:00' }));
    expect(result.recordedAt).toBe('2026-01-15T10:30:00.000Z');
  });
});
