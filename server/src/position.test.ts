import { describe, expect, it } from 'vitest';
import { distanceM, locate, offsetAlongTmc } from './position.ts';
import type { TmcLocation } from './tmc.ts';

// Gerade Strasse in Ost-West-Richtung: 1 -> 2 -> 3, je ca. 760 m (0.01° Länge auf 47° Breite).
const points: Record<number, TmcLocation> = {
  1: { name: 'West', road: 'A1', lat: 47, lng: 8.0, negative: null, positive: 2 },
  2: { name: 'Mitte', road: 'A1', lat: 47, lng: 8.01, negative: 1, positive: 3 },
  3: { name: 'Ost', road: 'A1', lat: 47, lng: 8.02, negative: 2, positive: null },
};
const tmc = (code: number) => points[code];
const segment = distanceM({ lat: 47, lng: 8.0 }, { lat: 47, lng: 8.01 });

describe('offsetAlongTmc', () => {
  it('geht bei Fahrtrichtung positiv stromaufwärts zum negativen Nachbarn', () => {
    expect(offsetAlongTmc(2, segment / 2, 'positive', tmc)?.lng).toBeCloseTo(8.005, 6);
  });

  it('geht bei Fahrtrichtung negativ zum positiven Nachbarn, auch über mehrere Punkte', () => {
    expect(offsetAlongTmc(1, segment * 1.5, 'negative', tmc)?.lng).toBeCloseTo(8.015, 6);
  });

  it('bleibt am Ende der Kette stehen', () => {
    expect(offsetAlongTmc(2, segment * 5, 'positive', tmc)).toEqual({ lat: 47, lng: 8.0 });
  });
});

describe('locate', () => {
  const site = { locationCode: 2, offsetDistance: segment / 2, direction: 'positive' as const };

  it('nutzt die berechnete Position, wenn sie zur gerundeten API-Koordinate passt', () => {
    expect(locate({ ...site, lat: 47.0, lng: 8.01 }, tmc)?.lng).toBeCloseTo(8.005, 6);
  });

  it('nutzt die API-Koordinate, wenn die TMC-Position weit daneben liegt', () => {
    expect(locate({ ...site, lat: 47.3, lng: 8.5 }, tmc)).toEqual({ lat: 47.3, lng: 8.5 });
  });

  it('ignoriert API-Koordinaten ausserhalb der Schweiz', () => {
    expect(locate({ ...site, lat: 47.27, lng: 0 }, tmc)?.lng).toBeCloseTo(8.005, 6);
  });

  it('fällt ohne TMC-Eintrag auf die API-Koordinate zurück', () => {
    expect(locate({ ...site, locationCode: 99, lat: 46.5, lng: 7.5 }, tmc)).toEqual({ lat: 46.5, lng: 7.5 });
  });
});
