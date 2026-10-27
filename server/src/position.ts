import type { TmcLocation, TmcLookup } from './tmc.ts';
import type { Direction } from './types.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SiteLocation {
  locationCode: number | null;
  offsetDistance: number | null;
  direction: Direction | null;
  lat: number | null;
  lng: number | null;
}

const EARTH_RADIUS_M = 6_371_000;
// Gerundete API-Koordinaten weichen bis ~600 m ab; darüber ist eine der Quellen fehlerhaft.
const MAX_DEVIATION_M = 1_500;
const MAX_STEPS = 100;

export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180;
  const x = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  const y = (b.lat - a.lat) * toRad;
  return Math.hypot(x, y) * EARTH_RADIUS_M;
}

function isInSwitzerland({ lat, lng }: LatLng): boolean {
  return lat > 45.7 && lat < 47.9 && lng > 5.8 && lng < 10.6;
}

function pointOf(lat: number | null, lng: number | null): LatLng | null {
  return lat === null || lng === null ? null : { lat, lng };
}

/**
 * ALERT-C Methode 4: Die Messstelle liegt `offset` Meter stromaufwärts vom TMC-Punkt,
 * also bei Fahrtrichtung positiv Richtung negativer Nachbarpunkt und umgekehrt.
 */
export function offsetAlongTmc(code: number, offset: number, direction: Direction | null, tmc: TmcLookup): LatLng | null {
  const start = tmc(code);
  const startPoint = start ? pointOf(start.lat, start.lng) : null;
  if (!start || !startPoint || !direction) return startPoint;

  let current: TmcLocation = start;
  let point: LatLng = startPoint;
  let remaining = offset;
  for (let step = 0; step < MAX_STEPS && remaining > 0; step++) {
    const nextCode = direction === 'positive' ? current.negative : current.positive;
    const next = nextCode === null ? undefined : tmc(nextCode);
    const target = next ? pointOf(next.lat, next.lng) : null;
    if (!next || !target) break;

    const segment = distanceM(point, target);
    if (remaining <= segment) {
      const t = remaining / segment;
      return { lat: point.lat + (target.lat - point.lat) * t, lng: point.lng + (target.lng - point.lng) * t };
    }
    remaining -= segment;
    point = target;
    current = next;
  }
  return point;
}

/** Bestmögliche Position: TMC + Offset, abgesichert gegen die (gerundete) API-Koordinate. */
export function locate(site: SiteLocation, tmc: TmcLookup): LatLng | null {
  const apiPoint = pointOf(site.lat, site.lng);
  const api = apiPoint && isInSwitzerland(apiPoint) ? apiPoint : null;
  const computed =
    site.locationCode === null ? null : offsetAlongTmc(site.locationCode, site.offsetDistance ?? 0, site.direction, tmc);

  if (computed && (!api || distanceM(computed, api) <= MAX_DEVIATION_M)) return computed;
  return api ?? computed;
}
