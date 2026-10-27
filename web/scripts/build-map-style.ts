// Erzeugt src/map/base-style.json aus der «Basiskarte leicht» von swisstopo: nur ruhige Layer, Roboto statt Frutiger,
// ohne Icons und nur mit der Landesgrenze. Die Markenfarben setzt src/map/tint.ts zur Laufzeit aus den Tokens.
// Aufruf: npm run build:map-style -w web
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const STYLE_URL = 'https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json';
const OUTPUT = fileURLToPath(new URL('../src/map/base-style.json', import.meta.url));

// Relief, Höhenlinien, POIs, Gipfel, Wege und Bahnen machen die Karte unruhig und lenken von den Zählstellen ab.
const KEEP_LAYERS = new Set([
  'background',
  'landcover',
  'landuse',
  'water_line',
  'water',
  'boundary',
  'tunnel_road',
  'road_casing',
  'road_fill',
  'building',
  'l1_road_casing',
  'l1_fill',
  'l2_road_casing',
  'l2_fill',
  'transportation_label',
  'road_number',
  'place_other',
  'place_town_village',
  'waterway_line_label',
  'water_name_point_label',
  'place_city',
  'place_country',
]);

// Nur die Landesgrenze (admin_level 2), keine Kantons- oder Gemeindegrenzen.
const COUNTRY_BOUNDARY_FILTER = ['all', ['==', 'admin_level', 2], ['!=', 'maritime', 1], ['!=', 'disputed', 1], ['==', '$type', 'LineString']];

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Layer = { id: string; type: string; source?: string; filter?: Json; layout?: Record<string, Json>; paint?: Record<string, Json> } & Record<string, Json>;

const robotoFor = (font: string) => (/Bold|Medium/.test(font) ? 'Roboto Medium' : 'Roboto Regular');

function replaceFonts(value: Json): Json {
  if (typeof value === 'string') return value.startsWith('Frutiger') ? robotoFor(value) : value;
  if (Array.isArray(value)) return value.map(replaceFonts);
  return value;
}

function simplify(layer: Layer): Layer {
  const result: Layer = { ...layer };
  delete result.metadata;
  if (layer.id === 'boundary') result.filter = COUNTRY_BOUNDARY_FILTER;

  if (layer.type === 'symbol' && layer.layout) {
    // Das Tool lädt kein Sprite; bei Layern mit Text bleibt nur die Beschriftung.
    const layout = Object.fromEntries(Object.entries(layer.layout).filter(([key]) => !key.startsWith('icon-')));
    if ('icon-image' in layer.layout && layout['symbol-placement'] !== 'line') {
      delete layout['text-offset'];
      layout['text-anchor'] = 'center';
    }
    // Wie auf der Intersys-Standortkarte: Ortsnamen normal geschrieben, nur Quartiere und Länder in Grossbuchstaben.
    if (layer.id === 'place_city' || layer.id === 'place_town_village') delete layout['text-transform'];
    layout['text-font'] = replaceFonts(layout['text-font'] ?? null);
    result.layout = layout;
    result.paint = Object.fromEntries(Object.entries(layer.paint ?? {}).filter(([key]) => !key.startsWith('icon-')));
  }
  return result;
}

const response = await fetch(STYLE_URL, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`${STYLE_URL}: HTTP ${response.status}`);
const style = (await response.json()) as { version: number; name?: string; sources: Record<string, Json>; layers: Layer[] };

const missing = [...KEEP_LAYERS].filter((id) => !style.layers.some((layer) => layer.id === id));
if (missing.length > 0) throw new Error(`Layer fehlen im swisstopo-Stil: ${missing.join(', ')}`);

const layers = style.layers.filter((layer) => KEEP_LAYERS.has(layer.id)).map(simplify);
const usedSources = new Set(layers.map((layer) => layer.source).filter((source) => source !== undefined));

const baseStyle = {
  version: style.version,
  name: `${style.name ?? 'swisstopo lightbasemap'} (Verkehrszähler)`,
  sources: Object.fromEntries(Object.entries(style.sources).filter(([id]) => usedSources.has(id))),
  layers,
};

writeFileSync(OUTPUT, `${JSON.stringify(baseStyle, null, 2)}\n`);
console.info(`src/map/base-style.json: ${layers.length} Layer aus ${STYLE_URL}`);
