function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export function getConfig() {
  return {
    dbHost: required('DB_HOST'),
    dbPort: Number(process.env.DB_PORT ?? 5432),
    dbName: required('DB_NAME'),
    dbSecretArn: required('DB_SECRET_ARN'),
    apiKeySecretArn: required('API_KEY_SECRET_ARN'),
    rawBucket: required('RAW_BUCKET'),
  };
}
