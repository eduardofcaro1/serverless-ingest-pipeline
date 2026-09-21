CREATE TABLE readings (
  id bigserial PRIMARY KEY,
  idempotency_key uuid NOT NULL UNIQUE,
  device_id text NOT NULL,
  metric text NOT NULL,
  value double precision NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  raw_object_key text NOT NULL
);

CREATE INDEX readings_device_metric_time_idx
  ON readings (device_id, metric, recorded_at DESC);
