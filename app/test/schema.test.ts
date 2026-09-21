import { describe, expect, it } from 'vitest';
import { batchSchema, readingSchema } from '../src/core/schema';
import { validReading } from './helpers';

describe('readingSchema', () => {
  it('accepts a valid reading', () => {
    expect(readingSchema.safeParse(validReading()).success).toBe(true);
  });

  it('rejects a unit that does not belong to the metric', () => {
    const result = readingSchema.safeParse(validReading({ metric: 'humidity', unit: 'C' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['unit']);
  });

  it('rejects an idempotency key that is not a uuid', () => {
    expect(readingSchema.safeParse(validReading({ idempotencyKey: 'abc' })).success).toBe(false);
  });

  it('rejects timestamps without an offset', () => {
    expect(readingSchema.safeParse(validReading({ recordedAt: '2026-01-15T10:30:00' })).success).toBe(false);
  });

  it('rejects timestamps in the future', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(readingSchema.safeParse(validReading({ recordedAt: future })).success).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(readingSchema.safeParse(validReading({ value: Number.POSITIVE_INFINITY })).success).toBe(false);
  });
});

describe('batchSchema', () => {
  it('rejects an empty batch', () => {
    expect(batchSchema.safeParse({ readings: [] }).success).toBe(false);
  });

  it('rejects batches above 100 readings', () => {
    const readings = Array.from({ length: 101 }, () => validReading());
    expect(batchSchema.safeParse({ readings }).success).toBe(false);
  });
});
