import { lazy, Suspense, useMemo, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { CounterDetails } from './CounterDetails.tsx';
import { CounterGroups } from './CounterGroups.tsx';
import { CounterSearch } from './CounterSearch.tsx';
import logoUrl from './design/assets/intersys-logo-white.svg';
import { groupKey } from './groups.ts';
import { de } from './i18n/de.ts';
import { formatTimestamp, measurementTimeOf, statusMessages, type MapProblem } from './status.ts';
import { STATUSES, statusOf, type Status } from './traffic.ts';
import type { MapCounter, MapFocus } from './TrafficMap.tsx';
import { useTrafficData } from './useTrafficData.ts';

// MapLibre ist gross; die Seitenleiste erscheint sofort, die Karte lädt nach.
const TrafficMap = lazy(() => import('./TrafficMap.tsx'));

const ALL_STATUSES = Object.keys(STATUSES) as Status[];

export function App() {
  const { counters, measurements, health, serverError, checkedAt } = useTrafficData();
  const [visible, setVisible] = useState<Set<Status>>(() => new Set(ALL_STATUSES));
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [mapProblem, setMapProblem] = useState<MapProblem | null>(null);

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
    mapProblem,
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
    <div className="app">
      <header className="app-header">
        <img className="app-header__logo" src={logoUrl} alt={de.brand.logoAlt} width={124} height={24} />
        <span className="app-header__name">{de.brand.toolName}</span>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div>
            <h1>{de.page.title}</h1>
            <p className="meta">
              {measuredAt ? de.page.measuredAt(formatTimestamp(measuredAt, checkedAt)) : de.page.loading}
              {' · '}
              {de.page.counterCount(counters.length)}
            </p>
          </div>

          {messages.length > 0 && (
            <ul className="notices" aria-live="polite">
              {messages.map(({ level, text }) => (
                <li key={text} className={level === 'error' ? 'notice notice--error' : 'notice'} role={level === 'error' ? 'alert' : undefined}>
                  <strong>{de.notice[level]}:</strong> {text}
                </li>
              ))}
            </ul>
          )}

          <CounterSearch counters={counters} onPick={pick} />

          <fieldset className="card">
            <legend>{de.statusFilter.legend}</legend>
            {ALL_STATUSES.map((status) => (
              <label key={status} className="check-field">
                <input type="checkbox" checked={visible.has(status)} onChange={() => toggle(status)} />
                <span className={`dot dot--${status}`} />
                {STATUSES[status].label}
                <span className="count">{totals[status]}</span>
              </label>
            ))}
            <p className="meta">{de.statusFilter.sizeHint}</p>
          </fieldset>

          <CounterGroups counters={mapCounters} hidden={hiddenGroups} onToggle={toggleGroups} onPick={pick} />

          {selected ? (
            <CounterDetails {...selected} onClose={() => setSelectedId(null)} />
          ) : (
            <p className="empty-state">{de.details.empty}</p>
          )}

          <footer className="meta">
            {de.page.source}:{' '}
            <a href="https://opentransportdata.swiss/de/dataset/trafficcounters" target="_blank" rel="noreferrer">
              opentransportdata.swiss
            </a>{' '}
            {de.page.sourceSuffix}
          </footer>
        </aside>

        <main className="map">
          <Suspense fallback={<p className="map-loading meta">{de.map.loading}</p>}>
            <TrafficMap
              counters={groupCounters.filter(({ status }) => visible.has(status))}
              selected={selected?.counter}
              focus={focus}
              onSelect={setSelectedId}
              onProblem={setMapProblem}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
