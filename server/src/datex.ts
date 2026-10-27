import { XMLParser } from 'fast-xml-parser';
import { areaOf, assessMinute } from './congestion.ts';
import { originOf } from './origin.ts';
import { locate } from './position.ts';
import { NO_SENSORS, type SensorLookup } from './sensors.ts';
import type { TmcLookup } from './tmc.ts';
import type { Carriageway, Counter, CounterValues, Direction, LaneValues, MeasurementsResponse, VehicleClass } from './types.ts';

interface Channel {
  kind: 'flow' | 'speed';
  vehicle: VehicleClass;
}

export interface SiteRecord {
  id: string;
  counterId: string;
  direction: Direction | null;
  lane: string | null;
  carriageway: Carriageway | null;
  locationCode: number | null;
  offsetDistance: number | null;
  lat: number | null;
  lng: number | null;
  channels: Map<string, Channel>;
}

export interface SiteTable {
  publicationTime: string | null;
  records: SiteRecord[];
}

// Übliche ASTRA-Belegung, falls eine Messstelle keine eigenen Kanaldefinitionen liefert.
const DEFAULT_CHANNELS = new Map<string, Channel>([
  ['1', { kind: 'flow', vehicle: 'any' }],
  ['2', { kind: 'speed', vehicle: 'any' }],
  ['11', { kind: 'flow', vehicle: 'car' }],
  ['12', { kind: 'speed', vehicle: 'car' }],
  ['21', { kind: 'flow', vehicle: 'lorry' }],
  ['22', { kind: 'speed', vehicle: 'lorry' }],
]);

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
});

type XmlNode = Record<string, unknown>;

function get(node: unknown, ...path: string[]): unknown {
  let current = node;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as XmlNode)[key];
  }
  return current;
}

function list(node: unknown): unknown[] {
  if (node === undefined || node === null) return [];
  return Array.isArray(node) ? node : [node];
}

function text(node: unknown): string | null {
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  const inner = get(node, '#text');
  return inner === undefined ? null : text(inner);
}

function num(node: unknown): number | null {
  const value = text(node);
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function payloadOf(xml: string): unknown {
  const body = get(parser.parse(xml), 'Envelope', 'Body');
  const fault = get(body, 'Fault');
  if (fault) {
    throw new Error(`SOAP-Fault: ${text(get(fault, 'faultstring')) ?? 'unbekannt'}`);
  }
  const payload = get(body, 'd2LogicalModel', 'payloadPublication');
  if (!payload) throw new Error('Antwort enthält keine payloadPublication');
  return payload;
}

function toVehicle(value: string | null): VehicleClass {
  return value === 'car' || value === 'lorry' ? value : 'any';
}

function toDirection(value: string | null): Direction | null {
  return value === 'positive' || value === 'negative' ? value : null;
}

const CARRIAGEWAYS: Record<string, Carriageway> = {
  mainCarriageway: 'main',
  parallelCarriageway: 'parallel',
  entrySlipRoad: 'entry',
  exitSlipRoad: 'exit',
};

function toCarriageway(value: string | null): Carriageway | null {
  return value === null ? null : (CARRIAGEWAYS[value] ?? 'other');
}

function isThroughLane(record: SiteRecord | undefined): boolean {
  return record?.carriageway === 'main' || record?.carriageway === 'parallel';
}

/** "CH:0542.05" (Fahrstreifen) -> "CH:0542" (Zählstelle) */
export function counterIdOf(laneId: string): string {
  return laneId.replace(/\.\d+$/, '');
}

function parseRecord(node: unknown): SiteRecord | null {
  const id = text(get(node, '@_id'));
  if (!id) return null;

  const channels = new Map<string, Channel>();
  for (const characteristic of list(get(node, 'measurementSpecificCharacteristics'))) {
    const index = text(get(characteristic, '@_index'));
    const inner = get(characteristic, 'measurementSpecificCharacteristics');
    const type = text(get(inner, 'specificMeasurementValueType'));
    const kind = type === 'trafficFlow' ? 'flow' : type === 'trafficSpeed' ? 'speed' : null;
    if (index && kind) {
      channels.set(index, {
        kind,
        vehicle: toVehicle(text(get(inner, 'specificVehicleCharacteristics', 'vehicleType'))),
      });
    }
  }

  const location = get(node, 'measurementSiteLocation');
  const alertC = get(location, 'alertCPoint');
  const primary = get(alertC, 'alertCMethod4PrimaryPointLocation') ?? get(alertC, 'alertCMethod2PrimaryPointLocation');
  const lanes = list(get(location, 'supplementaryPositionalDescription', 'affectedCarriagewayAndLanes'));
  const coordinates = get(location, 'pointByCoordinates', 'pointCoordinates');

  return {
    id,
    counterId: counterIdOf(id),
    direction: toDirection(text(get(alertC, 'alertCDirection', 'alertCDirectionCoded'))),
    lane: text(get(lanes[0], 'lane')),
    carriageway: toCarriageway(text(get(lanes[0], 'carriageway'))),
    locationCode: num(get(primary, 'alertCLocation', 'specificLocation')),
    offsetDistance: num(get(primary, 'offsetDistance', 'offsetDistance')),
    lat: num(get(coordinates, 'latitude')),
    lng: num(get(coordinates, 'longitude')),
    channels,
  };
}

export function parseSiteTable(xml: string): SiteTable {
  const payload = payloadOf(xml);
  const records = list(get(payload, 'measurementSiteTable'))
    .flatMap((table) => list(get(table, 'measurementSiteRecord')))
    .map(parseRecord)
    .filter((record): record is SiteRecord => record !== null);
  return { publicationTime: text(get(payload, 'publicationTime')), records };
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** Fasst Fahrstreifen zu Zählstellen zusammen; Position = Mittel der Fahrstreifen-Positionen. */
export function buildCounters(records: SiteRecord[], tmc: TmcLookup, sensors: SensorLookup = NO_SENSORS): Counter[] {
  const groups = new Map<string, SiteRecord[]>();
  for (const record of records) {
    const group = groups.get(record.counterId);
    if (group) group.push(record);
    else groups.set(record.counterId, [record]);
  }

  const counters: Counter[] = [];
  for (const [id, lanes] of groups) {
    lanes.sort((a, b) => a.id.localeCompare(b.id));
    const located = lanes.map((lane) => {
      const sensor = sensors.lane(lane.id);
      return { lane, sensor, position: sensor ?? locate(lane, tmc) };
    });
    const positions = located.map(({ position }) => position).filter((position) => position !== null);
    if (positions.length === 0) continue;
    const location = lanes
      .map((lane) => (lane.locationCode === null ? undefined : tmc(lane.locationCode)))
      .find((entry) => entry !== undefined);
    const info = sensors.counter(id);
    const origin = originOf(id);

    counters.push({
      id,
      name: info?.name || location?.name || id,
      road: info?.road ?? location?.road ?? null,
      canton: info?.canton ?? origin.canton,
      source: origin.source,
      operator: origin.operator,
      lat: round6(positions.reduce((sum, p) => sum + p.lat, 0) / positions.length),
      lng: round6(positions.reduce((sum, p) => sum + p.lng, 0) / positions.length),
      area: areaOf(location),
      lanes: located.map(({ lane, sensor, position }) => ({
        id: lane.id,
        direction: lane.direction,
        lane: lane.lane,
        carriageway: lane.carriageway,
        towards: sensor?.towards ?? null,
        exact: sensor !== undefined,
        lat: position && round6(position.lat),
        lng: position && round6(position.lng),
      })),
    });
  }
  return counters.sort((a, b) => a.id.localeCompare(b.id));
}

function parseLaneValues(node: unknown, record: SiteRecord): LaneValues {
  const values: LaneValues = { flow: {}, speed: {}, error: null };
  for (const measured of list(get(node, 'measuredValue'))) {
    const index = text(get(measured, '@_index'));
    const basicData = get(measured, 'measuredValue', 'basicData');
    const flow = get(basicData, 'vehicleFlow');
    const speed = get(basicData, 'averageVehicleSpeed');
    const source = flow ?? speed;

    if (text(get(source, 'dataError')) === 'true') {
      values.error = text(list(get(source, 'reasonForDataError', 'values', 'value'))[0]) ?? 'UNKNOWN';
      continue;
    }

    const channel = (index && record.channels.get(index)) || (index && DEFAULT_CHANNELS.get(index));
    if (!channel) continue;
    const value = channel.kind === 'flow' ? num(get(flow, 'vehicleFlowRate')) : num(get(speed, 'speed'));
    if (value !== null) values[channel.kind][channel.vehicle] = value;
  }
  return values;
}

function laneFlow(lane: LaneValues): number | null {
  const { car, lorry, any } = lane.flow;
  if (car !== undefined || lorry !== undefined) return (car ?? 0) + (lorry ?? 0);
  return any ?? null;
}

/** Summe der Fahrzeuge/h und nach Verkehrsmenge gewichtete Durchschnittsgeschwindigkeit. */
export function aggregate(lanes: LaneValues[]): Pick<CounterValues, 'flow' | 'speed'> {
  let flowSum = 0;
  let hasFlow = false;
  let weightedSpeed = 0;
  let weight = 0;

  for (const lane of lanes) {
    if (lane.error) continue;
    const flow = laneFlow(lane);
    if (flow !== null) {
      flowSum += flow;
      hasFlow = true;
    }
    const classes: VehicleClass[] = lane.flow.car !== undefined || lane.flow.lorry !== undefined ? ['car', 'lorry'] : ['any'];
    for (const vehicle of classes) {
      const speed = lane.speed[vehicle];
      const count = lane.flow[vehicle];
      if (speed && count) {
        weightedSpeed += speed * count;
        weight += count;
      }
    }
  }

  return {
    flow: hasFlow ? Math.round(flowSum) : null,
    speed: weight > 0 ? Math.round(weightedSpeed / weight) : null,
  };
}

/**
 * Langsamste Fahrtrichtung mit ihrer Verkehrsmenge. Der Durchschnitt beider Richtungen verdeckt Staus,
 * wenn nur eine Richtung betroffen ist (z. B. 8 km/h stadteinwärts, 60 km/h stadtauswärts → Ø 19 km/h).
 */
export function slowestDirection(
  lanes: [string, LaneValues][],
  records: Map<string, SiteRecord>,
): { speed: number; flow: number | null } | null {
  const byDirection = new Map<string, LaneValues[]>();
  for (const [laneId, lane] of lanes) {
    const direction = records.get(laneId)?.direction ?? 'unknown';
    byDirection.set(direction, [...(byDirection.get(direction) ?? []), lane]);
  }
  let slowest: { speed: number; flow: number | null } | null = null;
  for (const group of byDirection.values()) {
    const { speed, flow } = aggregate(group);
    if (speed !== null && (slowest === null || speed < slowest.speed)) slowest = { speed, flow };
  }
  return slowest;
}

export function parseMeasurements(xml: string, records: Map<string, SiteRecord>): MeasurementsResponse {
  const payload = payloadOf(xml);
  const lanesByCounter = new Map<string, Record<string, LaneValues>>();
  const laneIdsByCounter = new Map<string, string[]>();
  let measurementTime: string | null = null;

  for (const record of records.values()) {
    laneIdsByCounter.set(record.counterId, [...(laneIdsByCounter.get(record.counterId) ?? []), record.id]);
  }
  for (const site of list(get(payload, 'siteMeasurements'))) {
    const laneId = text(get(site, 'measurementSiteReference', '@_id'));
    const record = laneId ? records.get(laneId) : undefined;
    if (!laneId || !record) continue;
    measurementTime ??= text(get(site, 'measurementTimeDefault'));

    const lanes = lanesByCounter.get(record.counterId) ?? {};
    lanes[laneId] = parseLaneValues(site, record);
    lanesByCounter.set(record.counterId, lanes);
  }

  const counters: Record<string, CounterValues> = {};
  for (const [counterId, lanes] of lanesByCounter) {
    const values = Object.values(lanes);
    // Laut Messstellentabelle, damit auch Fahrstreifen ohne Eintrag in den Messwerten als ausgefallen zählen.
    const laneIds = laneIdsByCounter.get(counterId) ?? Object.keys(lanes);
    const throughIds = laneIds.filter((laneId) => isThroughLane(records.get(laneId)));
    const countedIds = throughIds.length > 0 ? throughIds : laneIds;
    const counted = countedIds.flatMap((laneId): [string, LaneValues][] => {
      const lane = lanes[laneId];
      return lane ? [[laneId, lane]] : [];
    });
    const slowest = slowestDirection(counted, records);
    const measured = {
      ...aggregate(counted.map(([, lane]) => lane)),
      worstSpeed: slowest?.speed ?? null,
      worstFlow: slowest?.flow ?? null,
      countedLanes: countedIds.length,
      failedLanes: countedIds.length - counted.filter(([, lane]) => lane.error === null).length,
      lanes,
      errors: [...new Set(values.map((lane) => lane.error).filter((error) => error !== null))],
    };
    counters[counterId] = { ...measured, ...assessMinute(measured) };
  }

  return {
    publicationTime: text(get(payload, 'publicationTime')) ?? new Date().toISOString(),
    measurementTime,
    counters,
  };
}
