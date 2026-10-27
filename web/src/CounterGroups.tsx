import { useMemo, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { groupByOrigin } from './groups.ts';
import { de } from './i18n/de.ts';
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
    <fieldset className="card groups">
      <legend>{de.groups.legend}</legend>
      {groups.map(({ source, operators, total }) => {
        const keys = operators.map(({ key }) => key);
        const visibleCount = keys.filter((key) => !hidden.has(key)).length;
        return (
          <div key={source} className="group">
            <label className="check-field source">
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
                      <label className="check-field">
                        <input type="checkbox" checked={!hidden.has(key)} onChange={() => onToggle([key], hidden.has(key))} />
                        {operator}
                      </label>
                      <span className="count">{items.length}</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        aria-label={isOpen ? de.groups.hideCounters(operator) : de.groups.showCounters(operator)}
                        onClick={() => toggleList(key)}
                      >
                        <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                      </button>
                    </div>
                    {isOpen && (
                      <ul id={listId} className="pick-list">
                        {items.map(({ counter, status }) => (
                          <li key={counter.id}>
                            <button type="button" onClick={() => onPick(counter)} title={STATUSES[status].label}>
                              <span className={`dot dot--${status}`} />
                              {counter.name}
                              <span className="meta"> {[counter.road, counter.id].filter(Boolean).join(' · ')}</span>
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
      <p className="meta">{de.groups.hint}</p>
    </fieldset>
  );
}
