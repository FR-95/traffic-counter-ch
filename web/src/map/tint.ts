import type { StyleSpecification } from 'maplibre-gl';
import { token } from '../design/tokens.ts';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(value: string): Rgba | null {
  // Der CSS-Minifier kürzt Tokens (z. B. #ffffff → #fff), darum alle Hex-Längen akzeptieren.
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value.trim());
  if (hex) {
    const digits = hex[1]!.length <= 4 ? [...hex[1]!].map((d) => d + d).join('') : hex[1]!;
    const channel = (i: number) => parseInt(digits.slice(i * 2, i * 2 + 2), 16);
    return { r: channel(0), g: channel(1), b: channel(2), a: digits.length === 8 ? channel(3) / 255 : 1 };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) };
  const hsl = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value);
  if (hsl) {
    const [h, s, l] = [Number(hsl[1]) / 360, Number(hsl[2]) / 100, Number(hsl[3]) / 100];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
      const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255, a: hsl[4] === undefined ? 1 : Number(hsl[4]) };
  }
  return null;
}

const format = ({ r, g, b, a }: Rgba) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;

/** Mischt zwei Farben; t = 0 ergibt `from`, t = 1 ergibt `to`. */
const mix = (from: Rgba, to: Rgba, t: number, a = 1): Rgba => ({
  r: from.r + (to.r - from.r) * t,
  g: from.g + (to.g - from.g) * t,
  b: from.b + (to.b - from.b) * t,
  a,
});

const lightness = ({ r, g, b }: Rgba) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function tokenColor(name: `--${string}`): Rgba {
  const color = parseColor(token(name));
  if (!color) throw new Error(`Token ${name} ist keine Farbe`);
  return color;
}

// Helligkeit der swisstopo-Farbe → Anteil Weiss auf der Skala Deep Teal → White. Der Sockel hält Flächen und Strassen hell,
// damit die Ampelfarben der Zählstellen dominieren.
const LIGHTNESS_FLOOR = 0.35;
// Wasser hebt sich wie auf der Intersys-Standortkarte deutlich vom Land ab.
const WATER_SHARE_OF_WHITE = 0.66;
const BOUNDARY_SHARE_OF_WHITE = 0.45;
const HALO_OPACITY = 0.8;

// Strassennetz: Autobahnen in dunklem Teal, auch in der Nahansicht; Kantonsstrassen hell, Kantonsgrenzen dezent.
const FIXED_SHARE_OF_WHITE: Record<string, number> = {
  overview_motorway: 0.3,
  overview_main: 0.62,
  overview_canton: 0.5,
};
const MOTORWAY_FILL_SHARE = 0.3;
const MOTORWAY_CASING_SHARE = 0.15;
const ROAD_FILL_LAYERS = new Set(['road_fill', 'l1_fill', 'l2_fill']);
const ROAD_CASING_LAYERS = new Set(['road_casing', 'l1_road_casing', 'l2_road_casing']);

const WATER_LAYERS = new Set(['water', 'water_line']);
const PRIMARY_LABELS = new Set(['place_city', 'place_town_village', 'place_other', 'place_country', 'water_name_point_label', 'waterway_line_label']);

type Value = unknown;

function mapColors(value: Value, convert: (color: Rgba) => Rgba): Value {
  if (typeof value === 'string') {
    const color = parseColor(value);
    return color ? format(convert(color)) : value;
  }
  if (Array.isArray(value)) return value.map((item) => mapColors(item, convert));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapColors(item, convert)]));
  }
  return value;
}

/** Ersetzt in `["match", ["get", "class"], …]` die Farbe für Autobahnen (motorway, trunk). */
function recolorMotorways(value: Value, color: string): Value {
  if (!Array.isArray(value)) return value;
  const isClassMatch = value[0] === 'match' && Array.isArray(value[1]) && value[1][0] === 'get' && value[1][1] === 'class';
  return value.map((item, index) => {
    const label: Value = value[index - 1];
    const isOutput = isClassMatch && index >= 3 && index % 2 === 1 && index < value.length - 1;
    const isMotorway = Array.isArray(label) ? label.includes('motorway') || label.includes('trunk') : label === 'motorway' || label === 'trunk';
    if (isOutput && isMotorway && typeof item === 'string') return color;
    return recolorMotorways(item, color);
  });
}

/**
 * Rechnet den swisstopo-Stil in Markenfarben um: Grautöne laufen von --deep-teal bis --white,
 * Land ist --teal-surface, Wasser und Beschriftung in Deep Teal. Die Werte kommen zur Laufzeit aus den CSS-Tokens.
 */
export function tintStyle(base: StyleSpecification, glyphs: string): StyleSpecification {
  const deepTeal = tokenColor('--deep-teal');
  const white = tokenColor('--white');
  const land = tokenColor('--teal-surface');
  const inkMuted = tokenColor('--ink-muted');

  const layers = base.layers.map((layer) => {
    if (!('paint' in layer) || !layer.paint) return layer;
    const paint: Record<string, Value> = {};
    for (const [key, value] of Object.entries(layer.paint)) {
      if (!key.endsWith('-color')) {
        paint[key] = value;
      } else if (layer.id === 'background') {
        paint[key] = format(land);
      } else if (layer.id in FIXED_SHARE_OF_WHITE) {
        paint[key] = format(mix(deepTeal, white, FIXED_SHARE_OF_WHITE[layer.id]!));
      } else if (WATER_LAYERS.has(layer.id)) {
        paint[key] = mapColors(value, ({ a }) => mix(deepTeal, white, WATER_SHARE_OF_WHITE, a));
      } else if (layer.id === 'boundary') {
        paint[key] = mapColors(value, ({ a }) => mix(deepTeal, white, BOUNDARY_SHARE_OF_WHITE, a));
      } else if (key === 'text-color') {
        paint[key] = format(PRIMARY_LABELS.has(layer.id) ? deepTeal : inkMuted);
      } else if (key === 'text-halo-color') {
        paint[key] = format({ ...white, a: HALO_OPACITY });
      } else {
        paint[key] = mapColors(value, (color) => mix(deepTeal, white, LIGHTNESS_FLOOR + (1 - LIGHTNESS_FLOOR) * lightness(color), color.a));
        if (ROAD_FILL_LAYERS.has(layer.id)) paint[key] = recolorMotorways(paint[key], format(mix(deepTeal, white, MOTORWAY_FILL_SHARE)));
        if (ROAD_CASING_LAYERS.has(layer.id)) paint[key] = recolorMotorways(paint[key], format(mix(deepTeal, white, MOTORWAY_CASING_SHARE)));
      }
    }
    return { ...layer, paint } as typeof layer;
  });

  return { ...base, glyphs, layers };
}
