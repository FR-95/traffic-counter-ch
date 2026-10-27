import { buildCounters, parseMeasurements, parseSiteTable, type SiteRecord } from './datex.ts';
import type { PullAction } from './otd-client.ts';
import type { TmcLookup } from './tmc.ts';
import type { CountersResponse, HealthResponse, MeasurementsResponse } from './types.ts';

const RETRY_DELAY_MS = 30_000;

export interface TrafficStoreOptions {
  pull: (action: PullAction) => Promise<string>;
  tmc: TmcLookup;
  measurementIntervalMs: number;
  siteTableIntervalMs: number;
}

/** Fragt die API zentral ab, damit alle Besucher sich einen Request pro Minute teilen. */
export class TrafficStore {
  counters: CountersResponse | null = null;
  measurements: MeasurementsResponse | null = null;
  private lastError: string | null = null;
  private records = new Map<string, SiteRecord>();
  private timers = new Set<NodeJS.Timeout>();
  private measurementsStarted = false;
  private readonly options: TrafficStoreOptions;

  constructor(options: TrafficStoreOptions) {
    this.options = options;
  }

  start(): void {
    this.loop('Messstellen', () => this.refreshSites(), this.options.siteTableIntervalMs, () => {
      if (this.measurementsStarted) return;
      this.measurementsStarted = true;
      this.loop('Messwerte', () => this.refreshMeasurements(), this.options.measurementIntervalMs);
    });
  }

  stop(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }

  health(): HealthResponse {
    return {
      status: !this.counters || !this.measurements ? 'starting' : this.lastError ? 'degraded' : 'ok',
      countersUpdatedAt: this.counters?.updatedAt ?? null,
      measurementsPublishedAt: this.measurements?.publicationTime ?? null,
      lastError: this.lastError,
    };
  }

  private async refreshSites(): Promise<void> {
    const table = parseSiteTable(await this.options.pull('pullMeasurementSiteTable'));
    if (table.records.length === 0) throw new Error('Messstellentabelle ist leer');
    this.records = new Map(table.records.map((record) => [record.id, record]));
    this.counters = {
      updatedAt: table.publicationTime ?? new Date().toISOString(),
      counters: buildCounters(table.records, this.options.tmc),
    };
    console.info(`${this.counters.counters.length} Zählstellen (${table.records.length} Fahrstreifen) geladen`);
  }

  private async refreshMeasurements(): Promise<void> {
    this.measurements = parseMeasurements(await this.options.pull('pullMeasuredData'), this.records);
  }

  private loop(name: string, task: () => Promise<void>, intervalMs: number, onSuccess?: () => void): void {
    const run = async () => {
      let delay = intervalMs;
      try {
        await task();
        this.lastError = null;
        onSuccess?.();
      } catch (error) {
        this.lastError = `${name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(this.lastError);
        delay = Math.min(intervalMs, RETRY_DELAY_MS);
      }
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        void run();
      }, delay);
      this.timers.add(timer);
    };
    void run();
  }
}
