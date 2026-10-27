import { describe, expect, it } from 'vitest';
import { aggregate, buildCounters, counterIdOf, parseMeasurements, parseSiteTable } from './datex.ts';

const envelope = (payload: string) => `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:dx223="http://datex2.eu/schema/2/2_0">
<SOAP-ENV:Body><dx223:d2LogicalModel modelBaseVersion="2">
<dx223:payloadPublication xsi:type="dx223:MeasuredDataPublication" lang="en">
<dx223:publicationTime>2026-10-27T07:24:18Z</dx223:publicationTime>
${payload}
</dx223:payloadPublication></dx223:d2LogicalModel></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

const characteristic = (index: string, type: string, vehicle: string) => `
<dx223:measurementSpecificCharacteristics index="${index}"><dx223:measurementSpecificCharacteristics>
<dx223:specificMeasurementValueType>${type}</dx223:specificMeasurementValueType>
<dx223:specificVehicleCharacteristics><dx223:vehicleType>${vehicle}</dx223:vehicleType></dx223:specificVehicleCharacteristics>
</dx223:measurementSpecificCharacteristics></dx223:measurementSpecificCharacteristics>`;

const record = (id: string, direction: string, lane: string, location: number, carriageway = 'mainCarriageway') => `
<dx223:measurementSiteRecord xsi:type="dx223:MeasurementSiteRecord" id="${id}" version="1">
${characteristic('11', 'trafficFlow', 'car')}${characteristic('12', 'trafficSpeed', 'car')}
${characteristic('21', 'trafficFlow', 'lorry')}${characteristic('22', 'trafficSpeed', 'lorry')}
<dx223:measurementSiteLocation xsi:type="dx223:Point">
<dx223:supplementaryPositionalDescription><dx223:affectedCarriagewayAndLanes>
<dx223:carriageway>${carriageway}</dx223:carriageway><dx223:lane>${lane}</dx223:lane>
</dx223:affectedCarriagewayAndLanes></dx223:supplementaryPositionalDescription>
<dx223:alertCPoint xsi:type="dx223:AlertCMethod4Point">
<dx223:alertCDirection><dx223:alertCDirectionCoded>${direction}</dx223:alertCDirectionCoded></dx223:alertCDirection>
<dx223:alertCMethod4PrimaryPointLocation><dx223:alertCLocation>
<dx223:specificLocation>${location}</dx223:specificLocation>
</dx223:alertCLocation><dx223:offsetDistance><dx223:offsetDistance>0</dx223:offsetDistance></dx223:offsetDistance>
</dx223:alertCMethod4PrimaryPointLocation></dx223:alertCPoint>
<dx223:pointByCoordinates><dx223:pointCoordinates>
<dx223:latitude>46.96</dx223:latitude><dx223:longitude>7.47</dx223:longitude>
</dx223:pointCoordinates></dx223:pointByCoordinates>
</dx223:measurementSiteLocation></dx223:measurementSiteRecord>`;

const siteTableXml = envelope(`<dx223:measurementSiteTable id="OTD:TrafficData" version="31">
${record('CH:0001.01', 'positive', 'lane1', 100)}
${record('CH:0001.02', 'negative', 'lane1', 100)}
${record('CH:0002.01', 'positive', 'lane2', 999)}
${record('CH:0002.02', 'positive', 'lane1', 999, 'exitSlipRoad')}
</dx223:measurementSiteTable>`);

const value = (index: string, inner: string) =>
  `<dx223:measuredValue index="${index}"><dx223:measuredValue><dx223:basicData>${inner}</dx223:basicData></dx223:measuredValue></dx223:measuredValue>`;
const flow = (index: string, rate: number) =>
  value(index, `<dx223:vehicleFlow><dx223:vehicleFlowRate>${rate}</dx223:vehicleFlowRate></dx223:vehicleFlow>`);
const speed = (index: string, kmh: string) =>
  value(index, `<dx223:averageVehicleSpeed numberOfInputValuesUsed="10"><dx223:speed>${kmh}</dx223:speed></dx223:averageVehicleSpeed>`);
const site = (id: string, values: string) => `<dx223:siteMeasurements>
<dx223:measurementSiteReference targetClass="MeasurementSiteRecord" id="${id}" version="1"/>
<dx223:measurementTimeDefault>2026-10-27T07:23:00Z</dx223:measurementTimeDefault>${values}</dx223:siteMeasurements>`;

const measurementsXml = envelope(`
${site('CH:0001.01', flow('11', 600) + speed('12', '100.00') + flow('21', 200) + speed('22', '80.00'))}
${site('CH:0001.02', value('0', '<dx223:vehicleFlow><dx223:dataError>true</dx223:dataError><dx223:reasonForDataError><dx223:values><dx223:value lang="en">VD_OFFLINE</dx223:value></dx223:values></dx223:reasonForDataError><dx223:vehicleFlowRate>0</dx223:vehicleFlowRate></dx223:vehicleFlow>'))}
${site('CH:0002.01', flow('11', 0) + flow('21', 0))}
${site('CH:0002.02', flow('11', 120) + speed('12', '40.00'))}
${site('CH:9999.01', flow('11', 10))}`);

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
    expect(counters[0]).toMatchObject({ id: 'CH:0001', name: 'Wankdorf', road: 'A6', lat: 46.9631, lng: 7.4652 });
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
