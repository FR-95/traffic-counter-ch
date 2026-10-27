// API-Vertrag zwischen Server und Web-Client.

export type Direction = 'positive' | 'negative';
export type VehicleClass = 'car' | 'lorry' | 'any';
export type Carriageway = 'main' | 'parallel' | 'entry' | 'exit' | 'other';

export interface Lane {
  id: string;
  direction: Direction | null;
  lane: string | null;
  carriageway: Carriageway | null;
  /** Zielort der Fahrtrichtung laut ASTRA, z. B. "Solothurn" */
  towards: string | null;
  /** true = Sensorstandort exakt, false = aus TMC berechnet */
  exact: boolean;
  lat: number | null;
  lng: number | null;
}

export interface Counter {
  id: string;
  name: string;
  road: string | null;
  canton: string | null;
  /** Herkunft laut ID-Präfix: "Bund" oder "Kanton …" */
  source: string;
  /** Betreiber laut ID-Präfix, z. B. "ASTRA", "Kanton Zürich" */
  operator: string;
  lat: number;
  lng: number;
  lanes: Lane[];
}

export interface CountersResponse {
  updatedAt: string;
  counters: Counter[];
}

export interface LaneValues {
  /** Fahrzeuge pro Stunde */
  flow: Partial<Record<VehicleClass, number>>;
  /** km/h */
  speed: Partial<Record<VehicleClass, number>>;
  /** DATEX-II-Fehlercode, z. B. VD_OFFLINE */
  error: string | null;
}

export interface CounterValues {
  /** Summe über die Hauptfahrbahn; Ein-/Ausfahrten nur, wenn es keine Hauptfahrbahn gibt */
  flow: number | null;
  speed: number | null;
  /** km/h der langsamsten Fahrtrichtung (gleiche Fahrstreifen wie `speed`); bestimmt die Verkehrslage */
  worstSpeed: number | null;
  /** Fahrstreifen, aus denen `flow`, `speed` und `worstSpeed` berechnet werden (laut Messstellentabelle) */
  countedLanes: number;
  /** davon ohne Daten: mit Fehlercode oder in den Messwerten nicht enthalten */
  failedLanes: number;
  lanes: Record<string, LaneValues>;
  errors: string[];
}

export interface MeasurementsResponse {
  publicationTime: string;
  measurementTime: string | null;
  counters: Record<string, CounterValues>;
}

export interface SourceStatus {
  /** letzter erfolgreicher Abruf bzw. Zeitpunkt des Cache-Eintrags */
  updatedAt: string | null;
  /** true, solange die Daten aus dem Disk-Cache eines früheren Laufs stammen */
  fromCache: boolean;
  /** Fehler des letzten Abrufversuchs, null wenn er erfolgreich war */
  error: string | null;
  failedAt: string | null;
}

export interface HealthResponse {
  status: 'ok' | 'starting' | 'degraded' | 'down';
  sites: SourceStatus;
  measurements: SourceStatus;
}
