import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export function buildEvent(options: {
  body?: unknown;
  headers?: Record<string, string>;
  raw?: string;
}): APIGatewayProxyEventV2 {
  const body = options.raw ?? (options.body === undefined ? undefined : JSON.stringify(options.body));

  return {
    version: '2.0',
    routeKey: 'POST /readings',
    rawPath: '/readings',
    rawQueryString: '',
    headers: options.headers ?? {},
    requestContext: { requestId: 'req-123' },
    body,
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

export function validReading(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: '3f9c1d3e-7a4b-4e39-9b41-6c9d1f0a2b11',
    deviceId: 'sensor-01',
    metric: 'temperature',
    value: 21.5,
    unit: 'C',
    recordedAt: '2026-01-15T10:30:00Z',
    ...overrides,
  };
}
