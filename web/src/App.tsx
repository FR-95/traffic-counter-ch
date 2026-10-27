import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { CounterDetails } from './CounterDetails.tsx';
import { CounterGroups } from './CounterGroups.tsx';
import { CounterSearch } from './CounterSearch.tsx';
import logoUrl from './design/assets/intersys-logo-white.svg';
import { Disruptions } from './Disruptions.tsx';
import { groupKey } from './groups.ts';
import { de } from './i18n/de.ts';
import { formatTimestamp, measurementTimeOf, statusMessages, type MapProblem } from './status.ts';
import { ALL_STATUSES, statusLabel, statusOf, type Status } from './traffic.ts';
import type { MapCounter, MapFocus } from './TrafficMap.tsx';
import { useTrafficData } from './useTrafficData.ts';

// MapLibre ist gross; die Seitenleiste erscheint sofort, die Karte lädt nach.
const TrafficMap = lazy(() => import('./TrafficMap.tsx'));

// Ausgewählte Zählstelle in der URL, damit sich ein Link auf sie teilen lässt (?z=CH:0182).
const SELECTION_PARAM = 'z';

function selectionFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get(SELECTION_PARAM);
}

function writeSelectionToUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(SELECTION_PARAM, id);
  else url.searchParams.delete(SELECTION_PARAM);
  window.history.replaceState(null, '', url);
}

export function App() {
  const { counters, measurements, health, serverError, checkedAt } = useTrafficData();
  const [visible, setVisible] = useState<Set<Status>>(() => new Set(ALL_STATUSES));
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(selectionFromUrl);
  const [selectionKey, setSelectionKey] = useState(0);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [mapProblem, setMapProblem] = useState<MapProblem | null>(null);
  const flewToInitial = useRef(false);

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

  useEffect(() => writeSelectionToUrl(selectedId), [selectedId]);

  // Beim Öffnen eines geteilten Links die Karte einmal auf die Zählstelle ausrichten.
  useEffect(() => {
    if (flewToInitial.current || !selected) return;
    flewToInitial.current = true;
    setFocus({ lat: selected.counter.lat, lng: selected.counter.lng, key: Date.now() });
  }, [selected]);

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

  const select = (id: string) => {
    flewToInitial.current = true;
    setSelectedId(id);
    setSelectionKey((key) => key + 1);
  };

  const pick = (counter: Counter) => {
    if (hiddenGroups.has(groupKey(counter))) toggleGroups([groupKey(counter)], true);
    if (!visible.has(statusOf(measurements?.counters[counter.id]))) toggle(statusOf(measurements?.counters[counter.id]));
    select(counter.id);
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
            {!selected && <p className="meta selection-hint">{de.details.empty}</p>}
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

          {selected && (
            <CounterDetails {...selected} selectionKey={selectionKey} onClose={() => setSelectedId(null)} />
          )}

          <Disruptions counters={groupCounters} loading={!measurements} onPick={pick} />

          <CounterSearch counters={counters} onPick={pick} />

          <fieldset className="card">
            <legend>{de.statusFilter.legend}</legend>
            {ALL_STATUSES.map((status) => (
              <label key={status} className="check-field">
                <input type="checkbox" checked={visible.has(status)} onChange={() => toggle(status)} />
                <span className={`dot dot--${status}`} aria-hidden="true" />
                {statusLabel(status)}
                <span className="count">{measurements ? totals[status] : de.statusFilter.countLoading}</span>
              </label>
            ))}
            <p className="meta">{de.statusFilter.hint}</p>
          </fieldset>

          <CounterGroups counters={mapCounters} hidden={hiddenGroups} onToggle={toggleGroups} onPick={pick} />

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
              onSelect={select}
              onProblem={setMapProblem}
            />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
