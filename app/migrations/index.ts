import type { Migration } from '../src/core/migrations';
import createReadings from './001_create_readings.sql';

export const migrations: Migration[] = [{ id: '001_create_readings', sql: createReadings }];
