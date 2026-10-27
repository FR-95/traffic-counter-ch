import { useEffect, useRef } from 'react';
import type { Counter, CounterValues, Lane, LaneValues } from '../../server/src/types.ts';
import { de } from './i18n/de.ts';
import { decisiveSpeed, directionLabel, errorText, laneLabel, statusLabel, type Status } from './traffic.ts';

interface Props {
  counter: Counter;
  values: CounterValues | undefined;
  status: Status;
  /** Ändert sich bei jeder Auswahl durch Nutzende; dann rücken die Details in Sicht und erhalten den Fokus. */
  selectionKey: number;
  onClose: () => void;
}

const format = (value: number | null | undefined, unit: string) => (value == null ? de.details.missing : `${Math.round(value)} ${unit}`);
const flowAndSpeed = (flow: number | undefined, speed: number | undefined) => (
  <>
    <span className="nowrap">{format(flow, de.units.vehiclesPerHour)}</span> · <span className="nowrap">{format(speed, de.units.kmh)}</span>
  </>
);

function groupByDirection(lanes: Lane[]): [string, Lane[]][] {
  const groups = new Map<string, Lane[]>();
  for (const lane of lanes) {
    const key = lane.direction ?? 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), lane]);
  }
  return [...groups.values()].map((group) => {
    const towards = [...new Set(group.map((lane) => lane.towards).filter((value) => value !== null))];
    return [towards.length > 0 ? de.details.towards(towards.join(' / ')) : directionLabel(group[0]?.direction ?? null), group];
  });
}

function locationText(lanes: Lane[]): string {
  if (lanes.every((lane) => lane.exact)) return de.details.locationExact;
  if (lanes.some((lane) => lane.exact)) return de.details.locationPartlyExact;
  return de.details.locationComputed;
}

function LaneItem({ lane, values, showTowards }: { lane: Lane; values: LaneValues | undefined; showTowards: boolean }) {
  const label = showTowards && lane.towards ? `${laneLabel(lane)} → ${lane.towards}` : laneLabel(lane);
  const hasClasses = values?.flow.car !== undefined || values?.flow.lorry !== undefined;
  return (
    <li>
      <span className="lane__name">{label}</span>
      {values?.error ? (
        <span className="lane-error">{errorText(values.error)}</span>
      ) : (
        <dl>
          <dt>{hasClasses ? de.details.cars : de.details.allVehicles}</dt>
          <dd>{hasClasses ? flowAndSpeed(values?.flow.car, values?.speed.car) : flowAndSpeed(values?.flow.any, values?.speed.any)}</dd>
          {hasClasses && (
            <>
              <dt>{de.details.lorries}</dt>
              <dd>{flowAndSpeed(values?.flow.lorry, values?.speed.lorry)}</dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}

export function CounterDetails({ counter, values, status, selectionKey, onClose }: Props) {
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (selectionKey === 0) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus({ preventScroll: true });
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    section.current?.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  }, [selectionKey]);

  const close = () => {
    onClose();
    const target = returnFocus.current;
    if (target?.isConnected && target !== document.body) target.focus();
  };

  const worst = decisiveSpeed(values);
  const showWorst = worst !== null && values?.speed != null && worst !== values.speed;

  return (
    <section
      ref={section}
      className="card details"
      aria-labelledby="details-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <header>
        <h2 id="details-title" ref={heading} tabIndex={-1}>
          {counter.name}
        </h2>
        <button type="button" className="button button--outline button--compact" onClick={close}>
          {de.details.close}
        </button>
      </header>
      <p className="meta">
        {[counter.road, counter.canton, counter.id].filter(Boolean).join(' · ')}
        <br />
        {counter.operator === counter.source ? counter.operator : `${counter.operator} (${counter.source})`}
        <br />
        {locationText(counter.lanes)}
      </p>
      <p className={`status-badge status-badge--${status}`}>
        <span className={`dot dot--${status}`} aria-hidden="true" />
        {statusLabel(status)}
      </p>
      <dl>
        <dt>{de.details.vehicles}</dt>
        <dd>{format(values?.flow, de.details.perHour)}</dd>
        <dt>{de.details.averageSpeed}</dt>
        <dd>{format(values?.speed, de.units.kmh)}</dd>
        {showWorst && (
          <>
            <dt>{de.details.slowestDirection}</dt>
            <dd>{format(worst, de.units.kmh)}</dd>
          </>
        )}
      </dl>
      {counter.lanes.some((lane) => lane.carriageway === 'main') &&
        counter.lanes.some((lane) => lane.carriageway === 'entry' || lane.carriageway === 'exit') && (
          <p className="meta">{de.details.withoutRamps}</p>
        )}

      {groupByDirection(counter.lanes).map(([direction, lanes]) => (
        <section key={direction} className="direction">
          <h3>{direction}</h3>
          <ul className="lanes">
            {lanes.map((lane) => (
              <LaneItem
                key={lane.id}
                lane={lane}
                values={values?.lanes[lane.id]}
                showTowards={new Set(lanes.map((l) => l.towards)).size > 1}
              />
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
