import type { Metric, Reading } from './schema';

export interface NormalizedReading {
  idempotencyKey: string;
  deviceId: string;
  metric: Metric;
  value: number;
  unit: string;
  recordedAt: string;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function convert(reading: Reading): { value: number; unit: string } {
  const { metric, value, unit } = reading;

  if (metric === 'temperature') {
    if (unit === 'F') return { value: ((value - 32) * 5) / 9, unit: 'C' };
    if (unit === 'K') return { value: value - 273.15, unit: 'C' };
  }

  if (metric === 'pressure' && unit === 'kPa') {
    return { value: value * 10, unit: 'hPa' };
  }

  return { value, unit };
}

export function normalize(reading: Reading): NormalizedReading {
  const { value, unit } = convert(reading);

  return {
    idempotencyKey: reading.idempotencyKey,
    deviceId: reading.deviceId,
    metric: reading.metric,
    value: round(value),
    unit,
    recordedAt: new Date(reading.recordedAt).toISOString(),
  };
}
