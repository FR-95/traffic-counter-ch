import { existsSync, readFileSync } from 'node:fs';

export interface TmcLocation {
  name: string;
  road: string | null;
  lat: number | null;
  lng: number | null;
}

export type TmcLookup = (code: number) => TmcLocation | undefined;

/** Format von data/tmc-locations.json, erzeugt mit `npm run build:tmc`. */
export type TmcFile = Record<string, [name: string, road: string | null, lat: number | null, lng: number | null]>;

export function loadTmc(file: string): TmcLookup {
  if (!existsSync(file)) {
    console.warn(`TMC-Datei ${file} nicht gefunden – Messstellen erhalten keine Ortsnamen.`);
    return () => undefined;
  }
  const data = JSON.parse(readFileSync(file, 'utf8')) as TmcFile;
  return (code) => {
    const entry = data[code];
    return entry && { name: entry[0], road: entry[1], lat: entry[2], lng: entry[3] };
  };
}
