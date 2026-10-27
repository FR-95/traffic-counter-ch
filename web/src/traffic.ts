import type { Carriageway, CounterValues, Direction, Lane } from '../../server/src/types.ts';

export type Status = 'jam' | 'slow' | 'free' | 'nodata';

export const STATUSES: Record<Status, { label: string; token: `--traffic-${Status}` }> = {
  jam: { label: 'Stau (< 10 km/h)', token: '--traffic-jam' },
  slow: { label: 'Stockend (< 30 km/h)', token: '--traffic-slow' },
  free: { label: 'Flüssig', token: '--traffic-free' },
  nodata: { label: 'Keine Daten', token: '--traffic-nodata' },
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

const CARRIAGEWAY_LABELS: Partial<Record<Carriageway, string>> = {
  entry: 'Einfahrt',
  exit: 'Ausfahrt',
  parallel: 'Parallelfahrbahn',
  other: 'Nebenfahrbahn',
};

export function laneLabel({ lane, carriageway }: Lane): string {
  const number = lane && /^lane(\d+)$/.exec(lane)?.[1];
  const base = !lane ? 'Fahrstreifen' : lane === 'emergencyLane' ? 'Pannenstreifen' : number ? `Spur ${number}` : lane;
  const suffix = carriageway && CARRIAGEWAY_LABELS[carriageway];
  return suffix ? `${base} (${suffix})` : base;
}

export function directionLabel(direction: Direction | null): string {
  if (direction === 'positive') return 'Fahrtrichtung +';
  if (direction === 'negative') return 'Fahrtrichtung −';
  return 'Fahrtrichtung unbekannt';
}
