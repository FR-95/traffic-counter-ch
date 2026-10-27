// Erzeugt data/tmc-locations.json aus der offiziellen TMC-Ortstabelle im LTEF-Format:
// https://data.opentransportdata.swiss/dataset/rds-tmc (ZIP entpacken, Ordner *_LTEF angeben)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TmcFile } from '../src/tmc.ts';

type Row = Record<string, string>;

function findLtefDir(input: string): string {
  if (existsSync(path.join(input, 'POINTS.DAT'))) return input;
  const child = readdirSync(input).find((name) => name.endsWith('_LTEF'));
  if (child) return path.join(input, child);
  throw new Error(`Kein LTEF-Ordner (POINTS.DAT) in ${input} gefunden`);
}

function readDat(dir: string, file: string): Row[] {
  const [header, ...lines] = readFileSync(path.join(dir, file), 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const columns = header?.split(';') ?? [];
  return lines.map((line) => {
    const values = line.split(';');
    return Object.fromEntries(columns.map((column, i) => [column, values[i] ?? '']));
  });
}

// LTEF speichert WGS84-Grad mal 100'000, z. B. "+00747706" = 7.47706
function coordinate(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value) / 1e5;
  return Number.isFinite(parsed) ? parsed : null;
}

const input = process.argv[2];
if (!input) {
  console.error('Aufruf: npm run build:tmc -w server -- <pfad/zum/entpackten/tmc_location_codes_vX-Y>');
  process.exit(1);
}

const dir = findLtefDir(input);
const version = readDat(dir, 'LOCATIONDATASETS.DAT')[0]?.VERSION ?? 'unbekannt';
const names = new Map(readDat(dir, 'NAMES.DAT').map((row) => [row.NID, row.NAME]));
const roadNumbers = new Map(
  [...readDat(dir, 'ROADS.DAT'), ...readDat(dir, 'SEGMENTS.DAT')].map((row) => [row.LCD, row.ROADNUMBER]),
);

const offsets = new Map(readDat(dir, 'POFFSETS.DAT').map((row) => [row.LCD, row]));
const code = (value: string | undefined) => (value ? Number(value) : null);

const output: TmcFile = {};
for (const point of readDat(dir, 'POINTS.DAT')) {
  if (!point.LCD) continue;
  const road = roadNumbers.get(point.ROA_LCD) || roadNumbers.get(point.SEG_LCD) || names.get(point.RNID) || null;
  const neighbours = offsets.get(point.LCD);
  output[point.LCD] = [
    names.get(point.N1ID) ?? '',
    road,
    coordinate(point.YCOORD),
    coordinate(point.XCOORD),
    code(neighbours?.NEG_OFF_LCD),
    code(neighbours?.POS_OFF_LCD),
  ];
}

const target = fileURLToPath(new URL('../data/tmc-locations.json', import.meta.url));
writeFileSync(target, JSON.stringify(output));
console.info(`TMC ${version}: ${Object.keys(output).length} Orte nach ${target} geschrieben`);
