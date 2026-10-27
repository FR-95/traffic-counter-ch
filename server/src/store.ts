import type { DiskCache } from './cache.ts';
import { buildCounters, parseMeasurements, parseSiteTable, type SiteRecord } from './datex.ts';
import type { PullAction } from './otd-client.ts';
import type { SensorLookup } from './sensors.ts';
import type { TmcLookup } from './tmc.ts';
import type { CountersResponse, HealthResponse, MeasurementsResponse, SourceStatus } from './types.ts';

const RETRY_DELAY_MS = 30_000;
const SITE_TABLE_CACHE = 'site-table.xml';
const MEASUREMENTS_CACHE = 'measurements.json';

type Source = 'sites' | 'measurements';
const LABELS: Record<Source, string> = { sites: 'Messstellen', measurements: 'Messwerte' };

export interface TrafficStoreOptions {
  pull: (action: PullAction) => Promise<string>;
  tmc: TmcLookup;
  sensors: SensorLookup;
  cache?: DiskCache;
  measurementIntervalMs: number;
  siteTableIntervalMs: number;
}

const emptyStatus = (): SourceStatus => ({ updatedAt: null, fromCache: false, error: null, failedAt: null });

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Fragt die API zentral ab, damit alle Besucher sich einen Request pro Minute teilen. */
export class TrafficStore {
  counters: CountersResponse | null = null;
  measurements: MeasurementsResponse | null = null;
  readonly status: Record<Source, SourceStatus> = { sites: emptyStatus(), measurements: emptyStatus() };
  private records = new Map<string, SiteRecord>();
  private timers = new Set<NodeJS.Timeout>();
  private measurementsStarted = false;
  private readonly options: TrafficStoreOptions;

  constructor(options: TrafficStoreOptions) {
    this.options = options;
  }

  start(): void {
    void this.restoreFromCache().finally(() => {
      const { siteTableIntervalMs, measurementIntervalMs } = this.options;
      this.loop('sites', () => this.refreshSites(), siteTableIntervalMs, this.remaining('sites', siteTableIntervalMs));
      if (this.records.size > 0) this.startMeasurements(this.remaining('measurements', measurementIntervalMs));
    });
  }

  stop(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  health(): HealthResponse {
    const { sites, measurements } = this.status;
    const hasErrors = sites.error !== null || measurements.error !== null;
    let status: HealthResponse['status'] = 'ok';
    if (!this.counters || !this.measurements) status = hasErrors ? 'down' : 'starting';
    else if (hasErrors || measurements.fromCache) status = 'degraded';
    return { status, sites: { ...sites }, measurements: { ...measurements } };
  }

  /** Fehlermeldung für API-Antworten, solange eine Quelle noch keine Daten hat. */
  unavailableReason(source: Source): string {
    const { error } = this.status[source];
    return error ? `${LABELS[source]} nicht verfügbar: ${error}` : `${LABELS[source]} werden geladen …`;
  }

  private startMeasurements(initialDelayMs = 0): void {
    if (this.measurementsStarted) return;
    this.measurementsStarted = true;
    this.loop('measurements', () => this.refreshMeasurements(), this.options.measurementIntervalMs, initialDelayMs);
  }

  /** Restlaufzeit eines Cache-Eintrags, damit Neustarts nicht sofort erneut die API abfragen. */
  private remaining(source: Source, intervalMs: number): number {
    const { updatedAt, fromCache } = this.status[source];
    if (!fromCache || !updatedAt) return 0;
    return Math.max(0, intervalMs - (Date.now() - Date.parse(updatedAt)));
  }

  private applySiteTable(xml: string, updatedAt: string): void {
    const table = parseSiteTable(xml);
    if (table.records.length === 0) throw new Error('Messstellentabelle ist leer');
    this.records = new Map(table.records.map((record) => [record.id, record]));
    this.counters = {
      updatedAt: table.publicationTime ?? updatedAt,
      counters: buildCounters(table.records, this.options.tmc, this.options.sensors),
    };
    console.info(`${this.counters.counters.length} Zählstellen (${table.records.length} Fahrstreifen) geladen`);
  }

  private async restoreFromCache(): Promise<void> {
    const cache = this.options.cache;
    if (!cache) return;
    const sites = await cache.read(SITE_TABLE_CACHE);
    if (!sites) return;
    try {
      this.applySiteTable(sites.data, sites.savedAt);
      this.status.sites = { ...emptyStatus(), updatedAt: sites.savedAt, fromCache: true };
      const measurements = await cache.read(MEASUREMENTS_CACHE);
      if (measurements) {
        this.measurements = JSON.parse(measurements.data) as MeasurementsResponse;
        this.status.measurements = { ...emptyStatus(), updatedAt: measurements.savedAt, fromCache: true };
      }
      console.info(`Daten aus Cache vom ${sites.savedAt} wiederhergestellt`);
    } catch (error) {
      console.warn(`Cache unbrauchbar, wird ignoriert: ${message(error)}`);
    }
  }

  private async refreshSites(): Promise<void> {
    const xml = await this.options.pull('pullMeasurementSiteTable');
    this.applySiteTable(xml, new Date().toISOString());
    await this.options.cache?.write(SITE_TABLE_CACHE, xml);
    this.startMeasurements();
  }

  private async refreshMeasurements(): Promise<void> {
    const measurements = parseMeasurements(await this.options.pull('pullMeasuredData'), this.records);
    this.measurements = measurements;
    await this.options.cache?.write(MEASUREMENTS_CACHE, JSON.stringify(measurements));
  }

  private loop(source: Source, task: () => Promise<void>, intervalMs: number, initialDelayMs = 0): void {
    const schedule = (delay: number) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void run();
      }, delay);
      this.timers.add(timer);
    };
    const run = async () => {
      let delay = intervalMs;
      try {
        await task();
        this.status[source] = { ...emptyStatus(), updatedAt: new Date().toISOString() };
      } catch (error) {
        this.status[source] = { ...this.status[source], error: message(error), failedAt: new Date().toISOString() };
        console.error(`${LABELS[source]}: ${message(error)}`);
        delay = Math.min(intervalMs, RETRY_DELAY_MS);
      }
      schedule(delay);
    };
    if (initialDelayMs > 0) schedule(initialDelayMs);
    else void run();
  }
}
