import { z } from 'zod';

export const allowedUnits = {
  temperature: ['C', 'F', 'K'],
  humidity: ['%'],
  pressure: ['hPa', 'kPa'],
  battery: ['%'],
} as const;

export type Metric = keyof typeof allowedUnits;

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const readingSchema = z
  .object({
    idempotencyKey: z.uuid(),
    deviceId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    metric: z.enum(['temperature', 'humidity', 'pressure', 'battery']),
    value: z.number().finite(),
    unit: z.string().min(1).max(16),
    recordedAt: z.iso.datetime({ offset: true }),
  })
  .refine((reading) => (allowedUnits[reading.metric] as readonly string[]).includes(reading.unit), {
    path: ['unit'],
    error: (issue) => `unit is not valid for metric ${(issue.input as { metric: string }).metric}`,
  })
  .refine((reading) => Date.parse(reading.recordedAt) <= Date.now() + FUTURE_TOLERANCE_MS, {
    path: ['recordedAt'],
    error: 'recordedAt is in the future',
  });

export const batchSchema = z.object({
  readings: z.array(readingSchema).min(1).max(100),
});

export type Reading = z.infer<typeof readingSchema>;
