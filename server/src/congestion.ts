import type { TmcLocation } from './tmc.ts';
import type { Area, CounterValues, MeasurementsResponse, Status, StatusHint } from './types.ts';

// Definition ASTRA/BFS, ausserorts: mindestens 1 Minute unter 10 km/h (Stau) bzw. 30 km/h (stockend).
export const JAM_BELOW_KMH = 10;
export const SLOW_BELOW_KMH = 30;
// Flüsse sind Minutenwerte mal 60; ein oder zwei Fahrzeuge belegen keinen Stau.
export const MIN_FLOW = 180;
// Innerorts verlangt ASTRA 5 Minuten Verlustzeit an Knoten; eine Zählstelle misst nur die Geschwindigkeit.
export const URBAN_MINUTES = 5;

const MINUTE_MS = 60_000;
const JUNCTIONS = new Set(['P1.8', 'P1.9', 'P1.11']);

export interface Assessment {
  status: Status;
  statusHint: StatusHint | null;
}

/** Innerorts: Stadtstrasse oder Bezugspunkt an einem Knoten (Kreisel, Kreuzung) abseits der Autobahn. */
export function areaOf(location: TmcLocation | undefined): Area | null {
  if (!location?.roadClass) return null;
  if (location.roadClass === 'L1.1') return 'rural';
  if (location.roadClass === 'L5.0' || (location.pointType !== null && JUNCTIONS.has(location.pointType))) return 'urban';
  return 'rural';
}

/** Lage einer einzelnen Minute nach der Regel für ausserorts. */
export function assessMinute(values: Omit<CounterValues, 'status' | 'statusHint'> | undefined): Assessment {
  if (!values) return { status: 'nodata', statusHint: null };
  const speed = values.worstSpeed;
  if (speed === null) return { status: values.flow === 0 ? 'free' : 'nodata', statusHint: null };
  if (speed >= SLOW_BELOW_KMH) return { status: 'free', statusHint: null };
  // Ältere Cache-Einträge kennen worstFlow noch nicht.
  if ((values.worstFlow ?? values.flow ?? 0) < MIN_FLOW) return { status: 'free', statusHint: 'lowTraffic' };
  return { status: speed < JAM_BELOW_KMH ? 'jam' : 'slow', statusHint: null };
}

/**
 * Lage einer Zählstelle. `minutes` enthält die Werte der letzten URBAN_MINUTES Minuten, die neueste zuletzt;
 * `complete` sagt, ob die Daten so weit zurückreichen.
 */
export function assess(minutes: (CounterValues | undefined)[], complete: boolean, area: Area | null): Assessment {
  const current = assessMinute(minutes.at(-1));
  if (area !== 'urban' || (current.status !== 'jam' && current.status !== 'slow')) return current;
  const statuses = minutes.map((values) => assessMinute(values).status);
  if (!complete || statuses.some((status) => status !== 'jam' && status !== 'slow')) {
    return { status: 'free', statusHint: 'urbanPending' };
  }
  return { status: statuses.includes('slow') ? 'slow' : 'jam', statusHint: null };
}

const timeOf = (measurements: MeasurementsResponse) => Date.parse(measurements.measurementTime ?? measurements.publicationTime);

/**
 * Setzt die Lage aller Zählstellen in `latest` und liefert den Verlauf für den nächsten Aufruf.
 * Der Verlauf hält nur die Abrufe der letzten URBAN_MINUTES Minuten.
 */
export function applyAssessment(
  latest: MeasurementsResponse,
  history: MeasurementsResponse[],
  areas: Map<string, Area | null>,
): MeasurementsResponse[] {
  const time = timeOf(latest);
  const window = [
    ...history.filter((entry) => timeOf(entry) < time && timeOf(entry) > time - URBAN_MINUTES * MINUTE_MS),
    latest,
  ];
  const complete = timeOf(window[0]!) <= time - (URBAN_MINUTES - 1) * MINUTE_MS;
  for (const [id, values] of Object.entries(latest.counters)) {
    Object.assign(values, assess(window.map((entry) => entry.counters[id]), complete, areas.get(id) ?? null));
  }
  return window;
}
