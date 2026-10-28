import { describe, expect, it } from 'vitest';
import { aggregate, buildCounters, counterIdOf, parseMeasurements, parseSiteTable, slowestDirection } from './datex.ts';
import type { LaneValues } from './types.ts';
import { measurementsXml, siteTableXml } from './test-fixtures.ts';

describe('parseSiteTable', () => {
  it('liest Fahrstreifen mit Kanälen, Richtung und Ort', () => {
    const table = parseSiteTable(siteTableXml);
    expect(table.publicationTime).toBe('2026-10-27T07:24:18Z');
    expect(table.version).toBe('31');
    expect(table.records).toHaveLength(4);
    const [first] = table.records;
    expect(first).toMatchObject({
      id: 'CH:0001.01',
      counterId: 'CH:0001',
      direction: 'positive',
      lane: 'lane1',
      carriageway: 'main',
      locationCode: 100,
      offsetDistance: 0,
      lat: 46.96,
      lng: 7.47,
    });
    expect(table.records[3]?.carriageway).toBe('exit');
    expect(first?.channels.get('22')).toEqual({ kind: 'speed', vehicle: 'lorry' });
  });

  it('meldet SOAP-Fehler', () => {
    const fault = `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><SOAP-ENV:Fault><faultstring>Unauthorized</faultstring></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
    expect(() => parseSiteTable(fault)).toThrow('SOAP-Fault: Unauthorized');
  });
});

describe('buildCounters', () => {
  it('gruppiert Fahrstreifen und nutzt TMC-Name und -Position', () => {
    const tmc = (code: number) =>
      code === 100
        ? { name: 'Wankdorf', road: 'A6', lat: 46.9631, lng: 7.4652, negative: null, positive: null, roadClass: 'L1.1', pointType: 'P1.11' }
        : undefined;
    const counters = buildCounters(parseSiteTable(siteTableXml).records, tmc);
    expect(counters).toHaveLength(2);
    expect(counters[0]).toMatchObject({
      id: 'CH:0001',
      name: 'Wankdorf',
      road: 'A6',
      source: 'Bund',
      operator: 'ASTRA',
      lat: 46.9631,
      lng: 7.4652,
      area: 'rural',
    });
    expect(counters[0]?.lanes.map((lane) => lane.direction)).toEqual(['positive', 'negative']);
    expect(counters[1]).toMatchObject({ id: 'CH:0002', name: 'CH:0002', road: null, lat: 46.96, lng: 7.47, area: null });
  });

  it('bevorzugt exakte ASTRA-Sensorpositionen und -Namen', () => {
    const sensors = {
      lane: (id: string) =>
        ({
          'CH:0001.01': { lat: 46.9, lng: 7.4, towards: 'Bern' },
          'CH:0001.02': { lat: 46.9002, lng: 7.4002, towards: 'Zürich' },
        })[id],
      counter: (id: string) => (id === 'CH:0001' ? { name: 'Wankdorf (AB)', canton: 'BE', road: 'A6' } : undefined),
    };
    const [counter] = buildCounters(parseSiteTable(siteTableXml).records, () => undefined, sensors);
    expect(counter).toMatchObject({ name: 'Wankdorf (AB)', canton: 'BE', road: 'A6', lat: 46.9001, lng: 7.4001 });
    expect(counter?.lanes.map(({ towards, exact }) => [towards, exact])).toEqual([
      ['Bern', true],
      ['Zürich', true],
    ]);
  });
});

describe('parseMeasurements', () => {
  const records = new Map(parseSiteTable(siteTableXml).records.map((r) => [r.id, r]));
  const result = parseMeasurements(measurementsXml, records);

  it('aggregiert Verkehrsmenge und gewichtete Geschwindigkeit', () => {
    expect(result.publicationTime).toBe('2026-10-27T07:24:18Z');
    expect(result.measurementTime).toBe('2026-10-27T07:23:00Z');
    expect(result.siteTableVersion).toBe('31');
    expect(result.counters['CH:0001']).toMatchObject({
      flow: 800,
      speed: 95,
      worstSpeed: 95,
      worstFlow: 800,
      status: 'free',
      statusHint: null,
      errors: ['VD_OFFLINE'],
    });
    expect(result.counters['CH:0001']?.lanes['CH:0001.01']).toEqual({
      flow: { car: 600, lorry: 200 },
      speed: { car: 100, lorry: 80 },
      error: null,
    });
  });

  it('zählt Ein- und Ausfahrten nicht zur Hauptfahrbahn', () => {
    expect(result.counters['CH:0002']).toMatchObject({ flow: 0, speed: null, countedLanes: 1, failedLanes: 0, errors: [] });
    expect(result.counters['CH:0002']?.lanes['CH:0002.02']?.flow).toEqual({ car: 120 });
  });

  it('zählt Fahrstreifen mit Fehler oder ohne Messwerte als ausgefallen', () => {
    expect(result.counters['CH:0001']).toMatchObject({ countedLanes: 2, failedLanes: 1 });
    const first = records.get('CH:0001.01')!;
    const withMissing = new Map([...records, ['CH:0001.03', { ...first, id: 'CH:0001.03' }]]);
    expect(parseMeasurements(measurementsXml, withMissing).counters['CH:0001']).toMatchObject({ flow: 800, countedLanes: 3, failedLanes: 2 });
  });

  it('ignoriert unbekannte Messstellen', () => {
    expect(result.counters['CH:9999']).toBeUndefined();
  });
});

describe('Hilfsfunktionen', () => {
  it('counterIdOf entfernt die Fahrstreifennummer', () => {
    expect(counterIdOf('BE.CH:2102.02')).toBe('BE.CH:2102');
  });

  it('aggregate nutzt anyVehicle, wenn keine Fahrzeugklassen vorhanden sind', () => {
    expect(aggregate([{ flow: { any: 300 }, speed: { any: 50 }, error: null }])).toEqual({ flow: 300, speed: 50 });
  });

  it('aggregate zählt Fahrzeuge ohne Klassifizierung zur Verkehrsmenge', () => {
    const lane: LaneValues = { flow: { car: 60, lorry: 0, any: 240 }, speed: { car: 11, any: -1 }, error: null };
    expect(aggregate([lane])).toEqual({ flow: 300, speed: 11 });
  });

  it('aggregate ignoriert ungültige Geschwindigkeiten', () => {
    expect(aggregate([{ flow: { any: 300 }, speed: { any: -1 }, error: null }])).toEqual({ flow: 300, speed: null });
  });

  it('slowestDirection liefert die langsamste Fahrtrichtung statt des Durchschnitts', () => {
    const record = (id: string, direction: 'positive' | 'negative') =>
      [id, { id, counterId: 'CH:0001', direction, lane: 'lane1', carriageway: 'main', locationCode: null, offsetDistance: null, lat: null, lng: null, channels: new Map() }] as const;
    const records = new Map([record('a', 'positive'), record('b', 'negative')]);
    const lanes: [string, LaneValues][] = [
      ['a', { flow: { any: 360 }, speed: { any: 8 }, error: null }],
      ['b', { flow: { any: 900 }, speed: { any: 60 }, error: null }],
    ];
    expect(aggregate(lanes.map(([, lane]) => lane)).speed).toBe(45);
    expect(slowestDirection(lanes, records)).toEqual({ speed: 8, flow: 360 });
    expect(slowestDirection([], records)).toBeNull();
  });
});
