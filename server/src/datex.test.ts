import { describe, expect, it } from 'vitest';
import { aggregate, buildCounters, counterIdOf, parseMeasurements, parseSiteTable } from './datex.ts';
import { measurementsXml, siteTableXml } from './test-fixtures.ts';

describe('parseSiteTable', () => {
  it('liest Fahrstreifen mit Kanälen, Richtung und Ort', () => {
    const table = parseSiteTable(siteTableXml);
    expect(table.publicationTime).toBe('2026-10-27T07:24:18Z');
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
      code === 100 ? { name: 'Wankdorf', road: 'A6', lat: 46.9631, lng: 7.4652, negative: null, positive: null } : undefined;
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
    });
    expect(counters[0]?.lanes.map((lane) => lane.direction)).toEqual(['positive', 'negative']);
    expect(counters[1]).toMatchObject({ id: 'CH:0002', name: 'CH:0002', road: null, lat: 46.96, lng: 7.47 });
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
    expect(result.counters['CH:0001']).toMatchObject({ flow: 800, speed: 95, errors: ['VD_OFFLINE'] });
    expect(result.counters['CH:0001']?.lanes['CH:0001.01']).toEqual({
      flow: { car: 600, lorry: 200 },
      speed: { car: 100, lorry: 80 },
      error: null,
    });
  });

  it('zählt Ein- und Ausfahrten nicht zur Hauptfahrbahn', () => {
    expect(result.counters['CH:0002']).toMatchObject({ flow: 0, speed: null, errors: [] });
    expect(result.counters['CH:0002']?.lanes['CH:0002.02']?.flow).toEqual({ car: 120 });
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
});
