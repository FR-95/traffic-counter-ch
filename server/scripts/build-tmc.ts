// Erzeugt data/tmc-locations.json aus einer TMC-Location-Code-Liste (JSON-Array).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TmcFile } from '../src/tmc.ts';

interface RawLocation {
  locationCode: number | string;
  firstName?: string;
  roadNumber?: string;
  roadName?: string;
  lat?: string | number;
  lon?: string | number;
}

const input = process.argv[2];
if (!input) {
  console.error('Aufruf: npm run build:tmc -w server -- <pfad/zu/tmc.json>');
  process.exit(1);
}

function coordinate(value: string | number | undefined): number | null {
  if (value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? Math.round(parsed * 1e5) / 1e5 : null;
}

const raw = JSON.parse(readFileSync(input, 'utf8')) as RawLocation[];
const output: TmcFile = {};
for (const location of raw) {
  if (!location.firstName) continue;
  output[String(location.locationCode)] = [
    location.firstName,
    location.roadNumber || location.roadName || null,
    coordinate(location.lat),
    coordinate(location.lon),
  ];
}

const target = fileURLToPath(new URL('../data/tmc-locations.json', import.meta.url));
writeFileSync(target, JSON.stringify(output));
console.info(`${Object.keys(output).length} Orte nach ${target} geschrieben`);
