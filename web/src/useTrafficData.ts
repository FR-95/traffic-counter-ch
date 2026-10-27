import { useEffect, useState } from 'react';
import type { Counter, CountersResponse, MeasurementsResponse } from '../../server/src/types.ts';

const MEASUREMENT_REFRESH_MS = 30_000;
const RETRY_MS = 5_000;

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Lädt die Zählstellen einmal und die Messwerte periodisch. */
export function useTrafficData() {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const data = await getJson<CountersResponse>('/api/counters', controller.signal);
        setCounters(data.counters);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(errorMessage(err));
        timer = setTimeout(load, RETRY_MS);
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
      let delay = MEASUREMENT_REFRESH_MS;
      try {
        setMeasurements(await getJson<MeasurementsResponse>('/api/measurements', controller.signal));
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(errorMessage(err));
        delay = RETRY_MS;
      }
      timer = setTimeout(load, delay);
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  return { counters, measurements, error };
}
