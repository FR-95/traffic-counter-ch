import type { Counter, CounterValues, Lane, LaneValues } from '../../server/src/types.ts';
import { de } from './i18n/de.ts';
import { directionLabel, errorText, laneLabel, STATUSES, type Status } from './traffic.ts';

interface Props {
  counter: Counter;
  values: CounterValues | undefined;
  status: Status;
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

function LaneRow({ lane, values, showTowards }: { lane: Lane; values: LaneValues | undefined; showTowards: boolean }) {
  const label = showTowards && lane.towards ? `${laneLabel(lane)} → ${lane.towards}` : laneLabel(lane);
  if (values?.error) {
    return (
      <tr>
        <th scope="row">{label}</th>
        <td colSpan={2} className="lane-error">
          {errorText(values.error)}
        </td>
      </tr>
    );
  }
  const hasClasses = values?.flow.car !== undefined || values?.flow.lorry !== undefined;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{hasClasses ? flowAndSpeed(values?.flow.car, values?.speed.car) : flowAndSpeed(values?.flow.any, values?.speed.any)}</td>
      <td>{hasClasses ? flowAndSpeed(values?.flow.lorry, values?.speed.lorry) : de.details.missing}</td>
    </tr>
  );
}

export function CounterDetails({ counter, values, status, onClose }: Props) {
  return (
    <section className="card details" aria-labelledby="details-title">
      <header>
        <h2 id="details-title">{counter.name}</h2>
        <button type="button" className="button button--outline button--compact" onClick={onClose}>
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
      <p>
        <span className={`dot dot--${status}`} /> {STATUSES[status].label}
      </p>
      <dl>
        <dt>{de.details.vehicles}</dt>
        <dd>{format(values?.flow, de.details.perHour)}</dd>
        <dt>{de.details.averageSpeed}</dt>
        <dd>{format(values?.speed, de.units.kmh)}</dd>
      </dl>
      {counter.lanes.some((lane) => lane.carriageway === 'main') &&
        counter.lanes.some((lane) => lane.carriageway === 'entry' || lane.carriageway === 'exit') && (
          <p className="meta">{de.details.withoutRamps}</p>
        )}

      {groupByDirection(counter.lanes).map(([direction, lanes]) => (
        <table key={direction}>
          <caption>{direction}</caption>
          <thead>
            <tr>
              <th scope="col">{de.details.lane}</th>
              <th scope="col">{de.details.cars}</th>
              <th scope="col">{de.details.lorries}</th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane) => (
              <LaneRow
                key={lane.id}
                lane={lane}
                values={values?.lanes[lane.id]}
                showTowards={new Set(lanes.map((l) => l.towards)).size > 1}
              />
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}
