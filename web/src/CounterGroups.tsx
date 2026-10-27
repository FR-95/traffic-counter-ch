import { useMemo, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { groupByOrigin } from './groups.ts';
import type { MapCounter } from './TrafficMap.tsx';
import { STATUSES } from './traffic.ts';

interface Props {
  counters: MapCounter[];
  hidden: ReadonlySet<string>;
  onToggle: (keys: string[], visible: boolean) => void;
  onPick: (counter: Counter) => void;
}

export function CounterGroups({ counters, hidden, onToggle, onPick }: Props) {
  const groups = useMemo(() => groupByOrigin(counters), [counters]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleList = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (groups.length === 0) return null;

  return (
    <fieldset className="legend groups">
      <legend>Quelle und Betreiber</legend>
      {groups.map(({ source, operators, total }) => {
        const keys = operators.map(({ key }) => key);
        const visibleCount = keys.filter((key) => !hidden.has(key)).length;
        return (
          <div key={source} className="group">
            <label className="source">
              <input
                type="checkbox"
                checked={visibleCount === keys.length}
                ref={(input) => {
                  if (input) input.indeterminate = visibleCount > 0 && visibleCount < keys.length;
                }}
                onChange={() => onToggle(keys, visibleCount < keys.length)}
              />
              {source}
              <span className="count">{total}</span>
            </label>
            <ul>
              {operators.map(({ key, operator, items }) => {
                const isOpen = expanded.has(key);
                const listId = `group-${key.replace(/[^\p{L}\d]+/gu, '-')}`;
                return (
                  <li key={key}>
                    <div className="operator">
                      <label>
                        <input type="checkbox" checked={!hidden.has(key)} onChange={() => onToggle([key], hidden.has(key))} />
                        {operator}
                      </label>
                      <button
                        type="button"
                        className="expand"
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        aria-label={`Zählstellen von ${operator} ${isOpen ? 'ausblenden' : 'anzeigen'}`}
                        onClick={() => toggleList(key)}
                      >
                        {isOpen ? '▾' : '▸'}
                      </button>
                      <span className="count">{items.length}</span>
                    </div>
                    {isOpen && (
                      <ul id={listId} className="counters">
                        {items.map(({ counter, status }) => (
                          <li key={counter.id}>
                            <button type="button" onClick={() => onPick(counter)} title={STATUSES[status].label}>
                              <span className="dot" style={{ background: STATUSES[status].color }} />
                              {counter.name}
                              <span className="muted small"> {[counter.road, counter.id].filter(Boolean).join(' · ')}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="muted small">Herkunft laut Zählstellen-ID; abgewählte Gruppen werden auf der Karte ausgeblendet.</p>
    </fieldset>
  );
}
