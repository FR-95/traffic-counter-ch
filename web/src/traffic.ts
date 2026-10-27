import type { Area, Carriageway, CounterValues, Direction, Lane, Status } from '../../server/src/types.ts';
import { de } from './i18n/de.ts';

export type { Status };

/** Reihenfolge nach Dringlichkeit, so auch in Legende und Störungsliste. */
export const ALL_STATUSES: Status[] = ['jam', 'slow', 'free', 'nodata'];

export const STATUS_TOKENS: Record<Status, `--traffic-${Status}`> = {
  jam: '--traffic-jam',
  slow: '--traffic-slow',
  free: '--traffic-free',
  nodata: '--traffic-nodata',
};

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
  return values?.status ?? 'nodata';
}

/** Warum langsamer Verkehr als «Flüssig» gilt, z. B. zu wenig Verkehr; sonst null. */
export function statusHintText(values: CounterValues | undefined): string | null {
  return values?.statusHint ? de.traffic.statusHint[values.statusHint] : null;
}

export function areaText(area: Area | null): string {
  return de.traffic.area[area ?? 'unknown'];
}

/** «1 von 4 Fahrstreifen ohne Daten», wenn die Lage nur auf einem Teil der Fahrstreifen beruht; sonst null. */
export function partialText(values: CounterValues | undefined): string | null {
  // Ältere Cache-Einträge des Servers kennen failedLanes noch nicht.
  if (!values?.failedLanes || statusOf(values) === 'nodata') return null;
  return de.traffic.partial(values.failedLanes, values.countedLanes);
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
