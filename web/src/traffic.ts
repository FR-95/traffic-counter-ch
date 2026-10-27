import type { Carriageway, CounterValues, Direction, Lane } from '../../server/src/types.ts';
import { de } from './i18n/de.ts';

export type Status = 'jam' | 'slow' | 'free' | 'nodata';

/** Reihenfolge nach Dringlichkeit, so auch in Legende und Störungsliste. */
export const ALL_STATUSES: Status[] = ['jam', 'slow', 'free', 'nodata'];

export const STATUS_TOKENS: Record<Status, `--traffic-${Status}`> = {
  jam: '--traffic-jam',
  slow: '--traffic-slow',
  free: '--traffic-free',
  nodata: '--traffic-nodata',
};

const JAM_BELOW_KMH = 10;
const SLOW_BELOW_KMH = 30;

export function statusName(status: Status): string {
  return de.traffic.status[status];
}

/** «Stau (< 10 km/h)» für die Legende */
export function statusLabel(status: Status): string {
  const threshold = status === 'jam' || status === 'slow' ? de.traffic.threshold[status] : null;
  return threshold ? `${statusName(status)} (${threshold})` : statusName(status);
}

/** Geschwindigkeit, nach der die Lage beurteilt wird: die langsamere Fahrtrichtung. */
export function decisiveSpeed(values: CounterValues | undefined): number | null {
  if (!values) return null;
  // Ältere Cache-Einträge des Servers kennen worstSpeed noch nicht.
  return values.worstSpeed === undefined ? values.speed : values.worstSpeed;
}

export function statusOf(values: CounterValues | undefined): Status {
  if (!values) return 'nodata';
  const speed = decisiveSpeed(values);
  if (speed === null) return values.flow === 0 && values.errors.length === 0 ? 'free' : 'nodata';
  if (speed < JAM_BELOW_KMH) return 'jam';
  if (speed < SLOW_BELOW_KMH) return 'slow';
  return 'free';
}

export function errorText(code: string): string {
  return de.traffic.errors[code] ?? de.traffic.unknownError(code);
}

export function laneLabel({ lane, carriageway }: Lane): string {
  const number = lane && /^lane(\d+)$/.exec(lane)?.[1];
  const base = !lane ? de.traffic.lane : lane === 'emergencyLane' ? de.traffic.emergencyLane : number ? de.traffic.laneNumber(number) : lane;
  const suffix = carriageway && de.traffic.carriageway[carriageway as Exclude<Carriageway, 'main'>];
  return suffix ? `${base} (${suffix})` : base;
}

export function directionLabel(direction: Direction | null): string {
  return de.traffic.direction[direction ?? 'unknown'];
}
