import type { Counter, CounterValues, Lane, LaneValues } from '../../server/src/types.ts';
import { directionLabel, errorText, laneLabel, STATUSES, type Status } from './traffic.ts';

interface Props {
  counter: Counter;
  values: CounterValues | undefined;
  status: Status;
  onClose: () => void;
}

const format = (value: number | null | undefined, unit: string) => (value == null ? '–' : `${Math.round(value)} ${unit}`);

function groupByDirection(lanes: Lane[]): [string, Lane[]][] {
  const groups = new Map<string, Lane[]>();
  for (const lane of lanes) {
    const key = directionLabel(lane.direction);
    groups.set(key, [...(groups.get(key) ?? []), lane]);
  }
  return [...groups];
}

function LaneRow({ lane, values }: { lane: Lane; values: LaneValues | undefined }) {
  if (values?.error) {
    return (
      <tr>
        <th scope="row">{laneLabel(lane.lane)}</th>
        <td colSpan={2} className="error">
          {errorText(values.error)}
        </td>
      </tr>
    );
  }
  const hasClasses = values?.flow.car !== undefined || values?.flow.lorry !== undefined;
  return (
    <tr>
      <th scope="row">{laneLabel(lane.lane)}</th>
      <td>
        {hasClasses
          ? `${format(values?.flow.car, 'Fz/h')} · ${format(values?.speed.car, 'km/h')}`
          : `${format(values?.flow.any, 'Fz/h')} · ${format(values?.speed.any, 'km/h')}`}
      </td>
      <td>{hasClasses ? `${format(values?.flow.lorry, 'Fz/h')} · ${format(values?.speed.lorry, 'km/h')}` : '–'}</td>
    </tr>
  );
}

export function CounterDetails({ counter, values, status, onClose }: Props) {
  return (
    <section className="details" aria-labelledby="details-title">
      <header>
        <h2 id="details-title">{counter.name}</h2>
        <button type="button" onClick={onClose} aria-label="Details schliessen">
          ×
        </button>
      </header>
      <p className="muted">
        {counter.road && `${counter.road} · `}
        {counter.id}
      </p>
      <p>
        <span className="dot" style={{ background: STATUSES[status].color }} /> {STATUSES[status].label}
      </p>
      <dl>
        <dt>Fahrzeuge</dt>
        <dd>{format(values?.flow, 'pro Stunde')}</dd>
        <dt>Ø Geschwindigkeit</dt>
        <dd>{format(values?.speed, 'km/h')}</dd>
      </dl>

      {groupByDirection(counter.lanes).map(([direction, lanes]) => (
        <table key={direction}>
          <caption>{direction}</caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Personenwagen</th>
              <th scope="col">Lastwagen</th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane) => (
              <LaneRow key={lane.id} lane={lane} values={values?.lanes[lane.id]} />
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}
