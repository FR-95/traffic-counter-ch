import { existsSync, readFileSync } from 'node:fs';
import type { LatLng } from './position.ts';

/** Format von data/astra-sensors.json, erzeugt mit `npm run build:sensors`. */
export interface SensorFile {
  source: string;
  fetchedAt: string;
  counters: Record<string, { name: string; canton: string | null; road: string | null }>;
  lanes: Record<string, [lat: number, lng: number, towards: string | null]>;
}

export interface Sensor extends LatLng {
  towards: string | null;
}

export interface SensorLookup {
  lane: (laneId: string) => Sensor | undefined;
  counter: (counterId: string) => SensorFile['counters'][string] | undefined;
}

export const NO_SENSORS: SensorLookup = { lane: () => undefined, counter: () => undefined };

export function loadSensors(file: string): SensorLookup {
  if (!existsSync(file)) {
    console.warn(`Sensor-Datei ${file} nicht gefunden – Positionen werden aus TMC berechnet.`);
    return NO_SENSORS;
  }
  const data = JSON.parse(readFileSync(file, 'utf8')) as SensorFile;
  return {
    lane: (laneId) => {
      const entry = data.lanes[laneId];
      return entry && { lat: entry[0], lng: entry[1], towards: entry[2] };
    },
    counter: (counterId) => data.counters[counterId],
  };
}
