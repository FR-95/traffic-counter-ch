import { useMemo, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';

const MAX_RESULTS = 8;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function CounterSearch({ counters, onPick }: { counters: Counter[]; onPick: (counter: Counter) => void }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (needle.length < 2) return [];
    return counters
      .filter((counter) =>
        normalize(
          `${counter.name} ${counter.id} ${counter.road ?? ''} ${counter.canton ?? ''} ${counter.source} ${counter.operator}`,
        ).includes(needle),
      )
      .slice(0, MAX_RESULTS);
  }, [counters, query]);

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Zählstelle suchen (Ort, Strasse, Nummer, Betreiber) …"
        aria-label="Zählstelle suchen"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length > 0 && (
        <ul>
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
                <span className="muted small"> {[counter.road, counter.canton, counter.operator, counter.id].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
