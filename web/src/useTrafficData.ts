import { useEffect, useState } from 'react';
import type { Counter, CountersResponse, HealthResponse, MeasurementsResponse } from '../../server/src/types.ts';

const REFRESH_MS = 30_000;
const RETRY_MS = 5_000;
const SERVER_UNREACHABLE = 'Server nicht erreichbar';

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(SERVER_UNREACHABLE, { cause: error });
  }
  if (response.ok) return (await response.json()) as T;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? (response.status >= 500 ? SERVER_UNREACHABLE : `HTTP ${response.status}`));
}

/** Abrufe auf :00 und :30 legen: Der Server holt die Daten bei :25 und hat sie dann bereit. */
const untilNextSlot = () => REFRESH_MS - (Date.now() % REFRESH_MS);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Lädt die Zählstellen einmal und Messwerte samt Serverstatus periodisch. Alte Daten bleiben bei Fehlern stehen. */
export function useTrafficData() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementsResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const data = await getJson<CountersResponse>('/api/counters', controller.signal);
        setCounters(data.counters);
      } catch {
        if (!controller.signal.aborted) timer = setTimeout(load, RETRY_MS);
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const [measured, status] = await Promise.allSettled([
        getJson<MeasurementsResponse>('/api/measurements', controller.signal),
        getJson<HealthResponse>('/api/health', controller.signal),
      ]);
      if (controller.signal.aborted) return;
      if (measured.status === 'fulfilled') setMeasurements(measured.value);
      if (status.status === 'fulfilled') setHealth(status.value);
      setServerError(status.status === 'rejected' ? errorMessage(status.reason) : null);
      setCheckedAt(Date.now());
      const failed = measured.status === 'rejected' || status.status === 'rejected';
      timer = setTimeout(load, failed ? RETRY_MS : untilNextSlot());
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return { counters, measurements, health, serverError, checkedAt };
}
