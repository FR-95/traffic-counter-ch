import { useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { de } from './i18n/de.ts';
import type { MapCounter } from './TrafficMap.tsx';
import { decisiveSpeed, statusName } from './traffic.ts';

const COLLAPSED_COUNT = 5;

// Die Quelldaten schreiben Strassennamen teils ohne Umlaute («Ueberlandstrasse» neben «Überlandstrasse»).
const comparable = (value: string) => value.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');
const sameName = (road: string | null, name: string) => road !== null && comparable(road) === comparable(name);

interface Props {
  counters: MapCounter[];
  loading: boolean;
  onPick: (counter: Counter) => void;
}

/** Stau und stockender Verkehr, langsamste zuerst: die schnellste Antwort auf «Wo staut es gerade?». */
export function Disruptions({ counters, loading, onPick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const disruptions = counters
    .filter(({ status }) => status === 'jam' || status === 'slow')
    .sort((a, b) => (decisiveSpeed(a.values) ?? 0) - (decisiveSpeed(b.values) ?? 0));
  const shown = expanded ? disruptions : disruptions.slice(0, COLLAPSED_COUNT);

  return (
    <section className="card disruptions" aria-labelledby="disruptions-title">
      <h2 id="disruptions-title" className="card__title">
        {de.disruptions.heading}
        {!loading && disruptions.length > 0 && <span className="count">{disruptions.length}</span>}
      </h2>
      {loading ? (
        <p className="meta">{de.disruptions.loading}</p>
      ) : disruptions.length === 0 ? (
        <p className="meta">{de.disruptions.empty}</p>
      ) : (
        <>
          <ul className="pick-list">
            {shown.map(({ counter, values, status }) => (
              <li key={counter.id}>
                <button type="button" onClick={() => onPick(counter)}>
                  <span className={`dot dot--${status}`} aria-hidden="true" />
                  <span className="pick-list__name">{counter.name}</span>
                  <span className="meta">
                    <strong className={`status-text status-text--${status}`}>{statusName(status)}</strong>
                    {[sameName(counter.road, counter.name) ? null : counter.road, `${decisiveSpeed(values)} ${de.units.kmh}`]
                      .filter(Boolean)
                      .map((part) => ` · ${part}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {disruptions.length > COLLAPSED_COUNT && (
            <button type="button" className="button button--outline button--compact" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              {expanded ? de.disruptions.showLess : de.disruptions.showAll(disruptions.length)}
            </button>
          )}
        </>
      )}
    </section>
  );
}
