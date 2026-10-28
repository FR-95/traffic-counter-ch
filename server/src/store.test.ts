import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiskCache } from './cache.ts';
import { createOtdClient, type PullAction } from './otd-client.ts';
import { NO_SENSORS } from './sensors.ts';
import { TrafficStore } from './store.ts';
import { measurementsXml, siteTableXml } from './test-fixtures.ts';

const HOUR = 3_600_000;
const offline = () => Promise.reject(new Error('Keine Verbindung zu opentransportdata.swiss'));
const online = (action: PullAction) => Promise.resolve(action === 'pullMeasuredData' ? measurementsXml : siteTableXml);

const stores: TrafficStore[] = [];
const dirs: string[] = [];

function createStore(pull: (action: PullAction) => Promise<string>, cache?: DiskCache, intervalMs = HOUR) {
  const store = new TrafficStore({
    pull,
    cache,
    tmc: () => undefined,
    sensors: NO_SENSORS,
    measurementIntervalMs: intervalMs,
    siteTableIntervalMs: intervalMs,
  });
  stores.push(store);
  store.start();
  return store;
}

async function tempCache() {
  const dir = await mkdtemp(path.join(tmpdir(), 'verkehrszaehler-'));
  dirs.push(dir);
  return new DiskCache(dir);
}

afterEach(async () => {
  stores.splice(0).forEach((store) => store.stop());
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TrafficStore', () => {
  it('meldet den Grund, solange keine Daten vorhanden sind', async () => {
    const store = createStore(offline);
    await vi.waitFor(() => expect(store.status.sites.error).not.toBeNull());
    expect(store.health().status).toBe('down');
    expect(store.unavailableReason('sites')).toBe('Messstellen nicht verfügbar: Keine Verbindung zu opentransportdata.swiss');
    expect(store.unavailableReason('measurements')).toBe('Messwerte werden geladen …');
  });

  it('lädt die Messstellentabelle neu, wenn die Messwerte auf eine neuere Version verweisen', async () => {
    const pulls: PullAction[] = [];
    const newer = measurementsXml.replace('id="OTD:TrafficData" version="31"', 'id="OTD:TrafficData" version="32"');
    const store = createStore((action) => {
      pulls.push(action);
      return Promise.resolve(action === 'pullMeasuredData' ? newer : siteTableXml);
    });
    await vi.waitFor(() => expect(store.measurements).not.toBeNull());
    await vi.waitFor(() => expect(pulls.filter((action) => action === 'pullMeasurementSiteTable')).toHaveLength(2));
    expect(pulls.filter((action) => action === 'pullMeasuredData')).toHaveLength(1);
  });

  it('führt Fehler pro Quelle getrennt', async () => {
    const store = createStore((action) => (action === 'pullMeasuredData' ? offline() : online(action)));
    await vi.waitFor(() => expect(store.status.measurements.error).not.toBeNull());
    expect(store.status.sites).toMatchObject({ error: null, fromCache: false });
    expect(store.counters?.counters).toHaveLength(2);
  });

  it('stellt nach einem Neustart frische Cache-Daten wieder her, ohne die API sofort erneut abzufragen', async () => {
    const cache = await tempCache();
    const first = createStore(online, cache);
    await vi.waitFor(() => expect(first.status.measurements.updatedAt).not.toBeNull());
    first.stop();

    const pull = vi.fn(offline);
    const second = createStore(pull, cache);
    await vi.waitFor(() => expect(second.measurements).not.toBeNull());
    expect(second.counters?.counters).toHaveLength(2);
    expect(second.measurements?.counters['CH:0001']?.flow).toBe(800);
    expect(second.status.sites.fromCache).toBe(true);
    expect(second.health().status).toBe('degraded');
    expect(pull).not.toHaveBeenCalled();
  });

  it('behält veraltete Cache-Daten, wenn die API nicht erreichbar ist', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cache = await tempCache();
    const first = createStore(online, cache);
    await vi.waitFor(() => expect(first.status.measurements.updatedAt).not.toBeNull());
    first.stop();

    const second = createStore(offline, cache, 1);
    await vi.waitFor(() => expect(second.status.sites.error).not.toBeNull());
    expect(second.counters?.counters).toHaveLength(2);
    expect(second.measurements?.counters['CH:0001']?.flow).toBe(800);
    expect(second.status.sites.fromCache).toBe(true);
    expect(second.health().status).toBe('degraded');
  });
});

describe('createOtdClient', () => {
  const pull = createOtdClient({ endpoint: 'https://example.invalid', apiKey: 'test' });

  it('übersetzt abgelehnte Keys in eine verständliche Meldung', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('', { status: 401 })));
    await expect(pull('pullMeasuredData')).rejects.toThrow('lehnt den API-Key ab (HTTP 401) – Key prüfen');
  });

  it('meldet fehlende Netzwerkverbindung', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('fetch failed')));
    await expect(pull('pullMeasuredData')).rejects.toThrow('Keine Verbindung zu opentransportdata.swiss');
  });
});
