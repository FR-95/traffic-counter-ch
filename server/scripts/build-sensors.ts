// Lädt die exakten Sensor-Standorte der ASTRA-Zählstellen (Feature-Service hinter dem
// SVZ-Dashboard) und schreibt data/astra-sensors.json.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SensorFile } from '../src/sensors.ts';

const SERVICE = 'https://services3.arcgis.com/IXAVBLfeIsfhE7s9/arcgis/rest/services/SVZ_2022/FeatureServer';
const SENSOR_LAYER = 0;
const COUNTER_LAYER = 1;

interface Feature {
  attributes: Record<string, string | number | null>;
  geometry?: { x: number; y: number };
}

async function queryAll(layer: number): Promise<Feature[]> {
  const features: Feature[] = [];
  for (;;) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      outSR: '4326',
      f: 'json',
      resultOffset: String(features.length),
    });
    const response = await fetch(`${SERVICE}/${layer}/query?${params}`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Layer ${layer}: HTTP ${response.status}`);
    const page = (await response.json()) as { features?: Feature[]; exceededTransferLimit?: boolean; error?: { message: string } };
    if (page.error) throw new Error(`Layer ${layer}: ${page.error.message}`);
    features.push(...(page.features ?? []));
    if (!page.exceededTransferLimit || !page.features?.length) return features;
  }
}

// "VERZW. A5/A1 ZUERICH" -> "Verzw. A5/A1 Zuerich", "LUTERBACH (AB)" -> "Luterbach (AB)"
function titleCase(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return String(value)
    .trim()
    .replace(/\(([^)]{1,3})\)|[\p{L}\d]+/gu, (token, short: string | undefined) => {
      if (short) return `(${short.toUpperCase()})`;
      if (/\d/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    });
}

function counterId(zsId: string | number | null): string | null {
  const number = Number(zsId);
  return Number.isInteger(number) ? `CH:${String(number).padStart(4, '0')}` : null;
}

const [sensors, counters] = await Promise.all([queryAll(SENSOR_LAYER), queryAll(COUNTER_LAYER)]);

const output: SensorFile = {
  source: SERVICE,
  fetchedAt: new Date().toISOString(),
  counters: {},
  lanes: {},
};

for (const { attributes } of counters) {
  const id = counterId(attributes.ZS_ID ?? null);
  const name = titleCase(attributes.Standort);
  if (!id || !name) continue;
  output.counters[id] = {
    name,
    canton: titleCase(attributes.Kanton)?.toUpperCase() ?? null,
    road: titleCase(attributes.Strasse),
  };
}

for (const { attributes, geometry } of sensors) {
  const laneId = attributes.SiteReferenceID;
  if (typeof laneId !== 'string' || !geometry) continue;
  output.lanes[laneId] = [
    Math.round(geometry.y * 1e6) / 1e6,
    Math.round(geometry.x * 1e6) / 1e6,
    titleCase(attributes.Fahrtrichtung),
  ];
}

const target = fileURLToPath(new URL('../data/astra-sensors.json', import.meta.url));
writeFileSync(target, JSON.stringify(output));
console.info(
  `${Object.keys(output.lanes).length} Sensoren und ${Object.keys(output.counters).length} Zählstellen nach ${target} geschrieben`,
);
