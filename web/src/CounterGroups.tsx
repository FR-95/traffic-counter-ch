import { useMemo, useState } from 'react';
import type { Counter } from '../../server/src/types.ts';
import { groupByOrigin, type OperatorGroup } from './groups.ts';
import { de } from './i18n/de.ts';
import type { MapCounter } from './TrafficMap.tsx';
import { statusName } from './traffic.ts';

interface Props {
  counters: MapCounter[];
  hidden: ReadonlySet<string>;
  onToggle: (keys: string[], visible: boolean) => void;
  onPick: (counter: Counter) => void;
}

const listIdOf = (key: string) => `group-${key.replace(/[^\p{L}\d]+/gu, '-')}`;

function CounterList({ group, onPick }: { group: OperatorGroup<MapCounter>; onPick: Props['onPick'] }) {
  return (
    <ul id={listIdOf(group.key)} className="pick-list">
      {group.items.map(({ counter, status }) => (
        <li key={counter.id}>
          <button type="button" onClick={() => onPick(counter)}>
            <span className={`dot dot--${status}`} aria-hidden="true" />
            <span className="visually-hidden">{statusName(status)}: </span>
            <span className="pick-list__name">{counter.name}</span>
            <span className="meta">{[counter.road, counter.id].filter(Boolean).join(' · ')}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExpandButton({ group, open, onClick }: { group: OperatorGroup<MapCounter>; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-expanded={open}
      aria-controls={listIdOf(group.key)}
      aria-label={open ? de.groups.hideCounters(group.operator) : de.groups.showCounters(group.operator)}
      onClick={onClick}
    >
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
  );
}

export function CounterGroups({ counters, hidden, onToggle, onPick }: Props) {
  const groups = useMemo(() => groupByOrigin(counters), [counters]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleList = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (groups.length === 0) return null;
  const operatorCount = groups.reduce((sum, group) => sum + group.operators.length, 0);
  const hiddenCount = groups.reduce((sum, group) => sum + group.operators.filter(({ key }) => hidden.has(key)).length, 0);

  return (
    <section className="card groups">
      <h2 className="card__title">
        <button type="button" className="disclosure" aria-expanded={open} aria-controls="groups-panel" onClick={() => setOpen(!open)}>
          <span>
            {de.groups.legend}
            <span className="meta disclosure__summary">{de.groups.summary(operatorCount, hiddenCount)}</span>
          </span>
          <span aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </h2>
      {open && (
        <fieldset id="groups-panel">
          <legend className="visually-hidden">{de.groups.legend}</legend>
          {groups.map(({ source, operators, total }) => {
            const keys = operators.map(({ key }) => key);
            const visibleCount = keys.filter((key) => !hidden.has(key)).length;
            // «Kanton Bern › Kanton Bern»: eine Zeile genügt, wenn der einzige Betreiber gleich heisst wie die Quelle.
            const single = operators.length === 1 && operators[0]!.operator === source ? operators[0]! : null;
            return (
              <div key={source} className="group">
                <div className="operator">
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
                  </label>
                  <span className="count">{total}</span>
                  {single && <ExpandButton group={single} open={expanded.has(single.key)} onClick={() => toggleList(single.key)} />}
                </div>
                {single ? (
                  expanded.has(single.key) && <CounterList group={single} onPick={onPick} />
                ) : (
                  <ul>
                    {operators.map((group) => (
                      <li key={group.key}>
                        <div className="operator">
                          <label className="check-field">
                            <input type="checkbox" checked={!hidden.has(group.key)} onChange={() => onToggle([group.key], hidden.has(group.key))} />
                            {group.operator}
                          </label>
                          <span className="count">{group.items.length}</span>
                          <ExpandButton group={group} open={expanded.has(group.key)} onClick={() => toggleList(group.key)} />
                        </div>
                        {expanded.has(group.key) && <CounterList group={group} onPick={onPick} />}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <p className="meta">{de.groups.hint}</p>
        </fieldset>
      )}
    </section>
  );
}
