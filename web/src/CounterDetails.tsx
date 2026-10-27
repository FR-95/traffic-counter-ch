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
    const key = lane.direction ?? 'unknown';
    groups.set(key, [...(groups.get(key) ?? []), lane]);
  }
  return [...groups.values()].map((group) => {
    const towards = [...new Set(group.map((lane) => lane.towards).filter((value) => value !== null))];
    return [towards.length > 0 ? `Richtung ${towards.join(' / ')}` : directionLabel(group[0]?.direction ?? null), group];
  });
}

function LaneRow({ lane, values, showTowards }: { lane: Lane; values: LaneValues | undefined; showTowards: boolean }) {
  const label = showTowards && lane.towards ? `${laneLabel(lane)} → ${lane.towards}` : laneLabel(lane);
  if (values?.error) {
    return (
      <tr>
        <th scope="row">{label}</th>
        <td colSpan={2} className="error">
          {errorText(values.error)}
        </td>
      </tr>
    );
  }
  const hasClasses = values?.flow.car !== undefined || values?.flow.lorry !== undefined;
  return (
    <tr>
      <th scope="row">{label}</th>
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
        {[counter.road, counter.canton, counter.id].filter(Boolean).join(' · ')}
        <br />
        {counter.operator === counter.source ? counter.operator : `${counter.operator} (${counter.source})`}
        <br />
        {counter.lanes.every((lane) => lane.exact)
          ? 'Standort exakt (ASTRA-Sensoren)'
          : counter.lanes.some((lane) => lane.exact)
            ? 'Standort teilweise exakt'
            : 'Standort berechnet (ca. 100–500 m genau)'}
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
      {counter.lanes.some((lane) => lane.carriageway === 'main') &&
        counter.lanes.some((lane) => lane.carriageway === 'entry' || lane.carriageway === 'exit') && (
          <p className="muted small">Summe und Durchschnitt ohne Ein- und Ausfahrten.</p>
        )}

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
