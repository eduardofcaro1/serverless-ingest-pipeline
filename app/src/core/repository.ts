import type { Pool } from 'pg';
import type { NormalizedReading } from './normalize';

const INSERT_READINGS = `
  INSERT INTO readings (idempotency_key, device_id, metric, value, unit, recorded_at, raw_object_key)
  SELECT t.idempotency_key, t.device_id, t.metric, t.value, t.unit, t.recorded_at, $7
  FROM unnest(
    $1::uuid[], $2::text[], $3::text[], $4::double precision[], $5::text[], $6::timestamptz[]
  ) AS t(idempotency_key, device_id, metric, value, unit, recorded_at)
  ON CONFLICT (idempotency_key) DO NOTHING
`;

export async function insertReadings(
  pool: Pool,
  readings: NormalizedReading[],
  rawObjectKey: string,
): Promise<number> {
  const result = await pool.query(INSERT_READINGS, [
    readings.map((r) => r.idempotencyKey),
    readings.map((r) => r.deviceId),
    readings.map((r) => r.metric),
    readings.map((r) => r.value),
    readings.map((r) => r.unit),
    readings.map((r) => r.recordedAt),
    rawObjectKey,
  ]);
  return result.rowCount ?? 0;
}
