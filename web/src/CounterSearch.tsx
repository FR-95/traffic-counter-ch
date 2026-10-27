import { useMemo, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { de } from './i18n/de.ts';

const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 2;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function CounterSearch({ counters, onPick }: { counters: Counter[]; onPick: (counter: Counter) => void }) {
  const [query, setQuery] = useState('');
  const needle = normalize(query.trim());
  const searching = needle.length >= MIN_QUERY_LENGTH && counters.length > 0;

  const results = useMemo(() => {
    if (needle.length < MIN_QUERY_LENGTH) return [];
    return counters
      .filter((counter) =>
        normalize(
          `${counter.name} ${counter.id} ${counter.road ?? ''} ${counter.canton ?? ''} ${counter.source} ${counter.operator}`,
        ).includes(needle),
      )
      .slice(0, MAX_RESULTS);
  }, [counters, needle]);

  return (
    <div className="search form-field">
      <label htmlFor="counter-search">{de.search.label}</label>
      <input
        id="counter-search"
        type="search"
        aria-describedby="counter-search-hint"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p id="counter-search-hint" className="form-field__hint">
        {de.search.hint}
      </p>
      {results.length > 0 && (
        <ul className="pick-list">
          {results.map((counter) => (
            <li key={counter.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(counter);
                  setQuery('');
                }}
              >
                {counter.name}
                <span className="meta"> {[counter.road, counter.canton, counter.operator, counter.id].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {searching && results.length === 0 && (
        <p className="empty-state" role="status">
          {de.search.empty}
        </p>
      )}
    </div>
  );
}
