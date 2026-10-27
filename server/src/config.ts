import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} muss eine positive Ganzzahl sein`);
  }
  return value;
}

const apiKey = process.env.OTD_API_KEY?.trim();
if (!apiKey) {
  throw new Error('OTD_API_KEY fehlt – siehe .env.example');
}

export const config = {
  apiKey,
  endpoint: process.env.OTD_ENDPOINT ?? 'https://api.opentransportdata.swiss/TDP/Soap_Datex2/Pull',
  host: process.env.HOST ?? '127.0.0.1',
  port: positiveInt('PORT', 3000),
  measurementIntervalMs: positiveInt('MEASUREMENT_INTERVAL_MS', 60_000),
  siteTableIntervalMs: positiveInt('SITE_TABLE_INTERVAL_MS', 6 * 60 * 60_000),
  tmcFile: process.env.TMC_FILE ?? fileURLToPath(new URL('../data/tmc-locations.json', import.meta.url)),
  sensorsFile: process.env.SENSORS_FILE ?? fileURLToPath(new URL('../data/astra-sensors.json', import.meta.url)),
  cacheDir: process.env.CACHE_DIR ?? fileURLToPath(new URL('../.cache', import.meta.url)),
  staticDir: process.env.STATIC_DIR ?? fileURLToPath(new URL('../../web/dist', import.meta.url)),
};
