import { useMemo, useState } from 'react';
import { CounterDetails } from './CounterDetails.tsx';
import { STATUSES, statusOf, type Status } from './traffic.ts';
import { TrafficMap, type MapCounter } from './TrafficMap.tsx';
import { useTrafficData } from './useTrafficData.ts';

const ALL_STATUSES = Object.keys(STATUSES) as Status[];
const timeFormat = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });

export function App() {
  const { counters, measurements, error } = useTrafficData();
  const [visible, setVisible] = useState<Set<Status>>(() => new Set(ALL_STATUSES));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapCounters = useMemo<MapCounter[]>(
    () =>
      counters.map((counter) => {
        const values = measurements?.counters[counter.id];
        return { counter, values, status: statusOf(values) };
      }),
    [counters, measurements],
  );

  const totals = useMemo(() => {
    const result = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<Status, number>;
    for (const { status } of mapCounters) result[status]++;
    return result;
  }, [mapCounters]);

  const selected = mapCounters.find(({ counter }) => counter.id === selectedId);
  const measuredAt = measurements?.measurementTime ?? measurements?.publicationTime;

  const toggle = (status: Status) =>
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  return (
    <div className="layout">
      <aside className="sidebar">
        <header>
          <h1>Verkehrszähler Schweiz</h1>
          <p className="muted">
            {measuredAt ? `Stand ${timeFormat.format(new Date(measuredAt))} Uhr` : 'Messwerte werden geladen …'}
            {' · '}
            {counters.length} Zählstellen
          </p>
          {error && <p className="error">Fehler beim Laden: {error}</p>}
        </header>

        <fieldset className="legend">
          <legend>Verkehrslage</legend>
          {ALL_STATUSES.map((status) => (
            <label key={status}>
              <input type="checkbox" checked={visible.has(status)} onChange={() => toggle(status)} />
              <span className="dot" style={{ background: STATUSES[status].color }} />
              {STATUSES[status].label}
              <span className="count">{totals[status]}</span>
            </label>
          ))}
          <p className="muted small">Kreisgrösse = Fahrzeuge pro Stunde</p>
        </fieldset>

        {selected ? (
          <CounterDetails {...selected} onClose={() => setSelectedId(null)} />
        ) : (
          <p className="muted">Zählstelle auf der Karte anklicken für Details.</p>
        )}

        <footer className="muted small">
          Daten:{' '}
          <a href="https://opentransportdata.swiss/de/dataset/trafficcounters" target="_blank" rel="noreferrer">
            opentransportdata.swiss
          </a>{' '}
          (ASTRA, minütlich aktualisiert)
        </footer>
      </aside>

      <main className="map">
        <TrafficMap
          counters={mapCounters.filter(({ status }) => visible.has(status))}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>
    </div>
  );
}
