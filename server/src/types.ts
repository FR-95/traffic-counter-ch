// API-Vertrag zwischen Server und Web-Client.

export type Direction = 'positive' | 'negative';
export type VehicleClass = 'car' | 'lorry' | 'any';
export type Carriageway = 'main' | 'parallel' | 'entry' | 'exit' | 'other';

export interface Lane {
  id: string;
  direction: Direction | null;
  lane: string | null;
  carriageway: Carriageway | null;
}

export interface Counter {
  id: string;
  name: string;
  road: string | null;
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
  lanes: Record<string, LaneValues>;
  errors: string[];
}

export interface MeasurementsResponse {
  publicationTime: string;
  measurementTime: string | null;
  counters: Record<string, CounterValues>;
}

export interface HealthResponse {
  status: 'ok' | 'starting' | 'degraded';
  countersUpdatedAt: string | null;
  measurementsPublishedAt: string | null;
  lastError: string | null;
}
