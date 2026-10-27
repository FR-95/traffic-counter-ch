import { useMemo, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { CounterDetails } from './CounterDetails.tsx';
import { CounterGroups } from './CounterGroups.tsx';
import { CounterSearch } from './CounterSearch.tsx';
import { groupKey } from './groups.ts';
import { formatTimestamp, measurementTimeOf, statusMessages } from './status.ts';
import { STATUSES, statusOf, type Status } from './traffic.ts';
import { TrafficMap, type MapCounter, type MapFocus } from './TrafficMap.tsx';
import { useTrafficData } from './useTrafficData.ts';

const ALL_STATUSES = Object.keys(STATUSES) as Status[];

export function App() {
  const { counters, measurements, health, serverError, checkedAt } = useTrafficData();
  const [visible, setVisible] = useState<Set<Status>>(() => new Set(ALL_STATUSES));
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [tileProblem, setTileProblem] = useState<string | null>(null);

  const mapCounters = useMemo<MapCounter[]>(
    () =>
      counters.map((counter) => {
        const values = measurements?.counters[counter.id];
        return { counter, values, status: statusOf(values) };
      }),
    [counters, measurements],
  );

  const groupCounters = useMemo(
    () => mapCounters.filter(({ counter }) => !hiddenGroups.has(groupKey(counter))),
    [mapCounters, hiddenGroups],
  );

  const totals = useMemo(() => {
    const result = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0])) as Record<Status, number>;
    for (const { status } of groupCounters) result[status]++;
    return result;
  }, [groupCounters]);

  const selected = mapCounters.find(({ counter }) => counter.id === selectedId);
  const measuredAt = measurementTimeOf(measurements);
  const messages = statusMessages({
    health,
    serverError,
    measurements,
    hasCounters: counters.length > 0,
    checkedAt,
    tileProblem,
  });

  const toggle = (status: Status) =>
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });

  const toggleGroups = (keys: string[], show: boolean) =>
    setHiddenGroups((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (show) next.delete(key);
        else next.add(key);
      }
      return next;
    });

  const pick = (counter: Counter) => {
    if (hiddenGroups.has(groupKey(counter))) toggleGroups([groupKey(counter)], true);
    setSelectedId(counter.id);
    setFocus({ lat: counter.lat, lng: counter.lng, key: Date.now() });
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <header>
          <h1>Verkehrszähler Schweiz</h1>
          <p className="muted">
            {measuredAt ? `Stand ${formatTimestamp(measuredAt, checkedAt)}` : 'Messwerte werden geladen …'}
            {' · '}
            {counters.length} Zählstellen
          </p>
        </header>

        {messages.length > 0 && (
          <ul className="status" aria-live="polite">
            {messages.map(({ level, text }) => (
              <li key={text} className={level} role={level === 'error' ? 'alert' : undefined}>
                {text}
              </li>
            ))}
          </ul>
        )}

        <CounterSearch counters={counters} onPick={pick} />

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

        <CounterGroups counters={mapCounters} hidden={hiddenGroups} onToggle={toggleGroups} onPick={pick} />

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
          counters={groupCounters.filter(({ status }) => visible.has(status))}
          selected={selected?.counter}
          focus={focus}
          onSelect={setSelectedId}
          onTileHealth={(layer, ok) => setTileProblem((current) => (ok ? (current === layer ? null : current) : layer))}
        />
      </main>
    </div>
  );
}
