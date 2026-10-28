import type { DiskCache } from './cache.ts';
import { applyAssessment } from './congestion.ts';
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
  /** Abrufe auf diesen Versatz nach der vollen Minute legen (opentransportdata.swiss veröffentlicht rund 20 s danach); ohne Angabe im Abstand von `measurementIntervalMs` */
  measurementOffsetMs?: number;
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
  private siteTableVersion: string | null = null;
  private requestedSiteTableVersion: string | null = null;
  private history: MeasurementsResponse[] = [];
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
      if (this.records.size > 0) {
        const remaining = this.remaining('measurements', measurementIntervalMs);
        this.startMeasurements(remaining > 0 ? remaining + this.untilNextSlot(Date.now() + remaining) : 0);
      }
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
    this.loop('measurements', () => this.refreshMeasurements(), this.options.measurementIntervalMs, initialDelayMs, (now) =>
      this.untilNextSlot(now),
    );
  }

  /** Wartezeit bis zum nächsten Abrufzeitpunkt nach `now`. */
  private untilNextSlot(now: number): number {
    const { measurementIntervalMs: interval, measurementOffsetMs: offset } = this.options;
    if (offset === undefined) return interval;
    return interval - ((((now - offset) % interval) + interval) % interval);
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
    this.siteTableVersion = table.version;
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
        this.applyMeasurements(JSON.parse(measurements.data) as MeasurementsResponse);
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
    this.applyMeasurements(measurements);
    await this.options.cache?.write(MEASUREMENTS_CACHE, JSON.stringify(measurements));
    await this.syncSiteTable(measurements.siteTableVersion);
  }

  /** Verweisen die Messwerte auf eine neuere Messstellentabelle, wird diese sofort geladen statt erst im 6-h-Takt. */
  private async syncSiteTable(referenced: string | null): Promise<void> {
    if (!referenced || referenced === this.siteTableVersion || referenced === this.requestedSiteTableVersion) return;
    this.requestedSiteTableVersion = referenced;
    console.info(`Messstellentabelle: Version ${this.siteTableVersion ?? '?'} → ${referenced}, wird neu geladen`);
    try {
      await this.refreshSites();
      this.status.sites = { ...emptyStatus(), updatedAt: new Date().toISOString() };
    } catch (error) {
      this.requestedSiteTableVersion = null;
      console.error(`${LABELS.sites}: ${message(error)}`);
    }
  }

  private applyMeasurements(measurements: MeasurementsResponse): void {
    const areas = new Map(this.counters?.counters.map((counter) => [counter.id, counter.area]));
    this.history = applyAssessment(measurements, this.history, areas);
    this.measurements = measurements;
  }

  private loop(
    source: Source,
    task: () => Promise<void>,
    intervalMs: number,
    initialDelayMs = 0,
    nextDelay: (now: number) => number = () => intervalMs,
  ): void {
    const schedule = (delay: number) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void run();
      }, delay);
      this.timers.add(timer);
    };
    const run = async () => {
      let delay: number;
      try {
        await task();
        this.status[source] = { ...emptyStatus(), updatedAt: new Date().toISOString() };
        delay = nextDelay(Date.now());
      } catch (error) {
        this.status[source] = { ...this.status[source], error: message(error), failedAt: new Date().toISOString() };
        console.error(`${LABELS[source]}: ${message(error)}`);
        delay = Math.min(nextDelay(Date.now()), RETRY_DELAY_MS);
      }
      schedule(delay);
    };
    if (initialDelayMs > 0) schedule(initialDelayMs);
    else void run();
  }
}
