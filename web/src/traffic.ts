import type { CounterValues, Direction } from '../../server/src/types.ts';

export type Status = 'jam' | 'slow' | 'free' | 'nodata';

export const STATUSES: Record<Status, { label: string; color: string }> = {
  jam: { label: 'Stau (< 10 km/h)', color: '#d7191c' },
  slow: { label: 'Stockend (< 30 km/h)', color: '#f28e2b' },
  free: { label: 'Flüssig', color: '#1a9641' },
  nodata: { label: 'Keine Daten', color: '#9e9e9e' },
};

export function statusOf(values: CounterValues | undefined): Status {
  if (!values) return 'nodata';
  if (values.speed === null) return values.flow === 0 && values.errors.length === 0 ? 'free' : 'nodata';
  if (values.speed < 10) return 'jam';
  if (values.speed < 30) return 'slow';
  return 'free';
}

export function markerRadius(flow: number | null | undefined): number {
  return 3 + Math.min(Math.sqrt(flow ?? 0) / 8, 9);
}

const ERROR_MESSAGES: Record<string, string> = {
  VD_OFFLINE: 'Verbindung zum Zählgerät unterbrochen',
  VD_ERROR: 'Zählgerät defekt',
  SENSOR_ERROR: 'Sensor offline oder defekt',
  SENSOR_WWD: 'Verkehr in Gegenrichtung erkannt (z. B. Baustelle oder Überholmanöver)',
  PRV_OFFLINE: 'Drittsystem offline',
  AGG_OFFLINE: 'Aggregationsdienst offline',
  EMPTY_RESPONSE: 'Datenlieferant offline',
};

export function errorText(code: string): string {
  return ERROR_MESSAGES[code] ?? `Messfehler (${code})`;
}

export function laneLabel(lane: string | null): string {
  if (!lane) return 'Fahrstreifen';
  if (lane === 'emergencyLane') return 'Pannenstreifen';
  const number = /^lane(\d+)$/.exec(lane)?.[1];
  return number ? `Spur ${number}` : lane;
}

export function directionLabel(direction: Direction | null): string {
  if (direction === 'positive') return 'Fahrtrichtung +';
  if (direction === 'negative') return 'Fahrtrichtung −';
  return 'Fahrtrichtung unbekannt';
}
