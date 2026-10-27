import type { HealthResponse, MeasurementsResponse } from '../../server/src/types.ts';
import { de } from './i18n/de.ts';

export interface StatusMessage {
  level: 'error' | 'warning' | 'info';
  text: string;
}

/** Hintergrundkarte nicht erreichbar bzw. Browser ohne WebGL */
export type MapProblem = 'tiles' | 'webgl';

interface StatusInput {
  health: HealthResponse | null;
  serverError: string | null;
  measurements: MeasurementsResponse | null;
  hasCounters: boolean;
  checkedAt: number | null;
  mapProblem: MapProblem | null;
}

const STALE_MS = 5 * 60_000;
const timeFormat = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** "08:23 Uhr" am selben Tag wie `reference`, sonst "26.10., 08:23 Uhr". */
export function formatTimestamp(iso: string | null | undefined, reference: number | null): string {
  if (!iso) return 'unbekannt';
  const date = new Date(iso);
  const sameDay = reference !== null && new Date(reference).toDateString() === date.toDateString();
  return `${(sameDay ? timeFormat : dateTimeFormat).format(date)} Uhr`;
}

export function measurementTimeOf(measurements: MeasurementsResponse | null): string | null {
  return measurements ? (measurements.measurementTime ?? measurements.publicationTime) : null;
}

export function statusMessages({ health, serverError, measurements, hasCounters, checkedAt, mapProblem }: StatusInput): StatusMessage[] {
  const messages: StatusMessage[] = [];
  const measuredAt = measurementTimeOf(measurements);
  const shownAt = formatTimestamp(measuredAt, checkedAt);

  if (serverError) {
    messages.push({
      level: 'error',
      text: measurements
        ? `Keine Verbindung zum Server. Angezeigt werden die zuletzt geladenen Messwerte (Stand ${shownAt}).`
        : 'Keine Verbindung zum Server. Neuer Versuch in wenigen Sekunden …',
    });
  } else if (health) {
    const { sites, measurements: live } = health;
    if (live.error) {
      messages.push(
        measurements
          ? { level: 'warning', text: `Live-Messwerte nicht verfügbar: ${live.error}. Angezeigt wird der letzte Stand vom ${shownAt}.` }
          : { level: 'error', text: `Keine Messwerte verfügbar: ${live.error}.` },
      );
    } else if (live.fromCache && measurements) {
      messages.push({ level: 'info', text: `Messwerte aus dem Zwischenspeicher (Stand ${shownAt}), Aktualisierung läuft …` });
    } else if (measuredAt && checkedAt !== null && checkedAt - Date.parse(measuredAt) > STALE_MS) {
      messages.push({ level: 'warning', text: `opentransportdata.swiss liefert veraltete Messwerte (Stand ${shownAt}).` });
    }

    if (sites.error) {
      messages.push(
        hasCounters
          ? {
              level: 'info',
              text: `Zählstellen konnten nicht aktualisiert werden (${sites.error}). Verwendet wird der Stand vom ${formatTimestamp(sites.updatedAt, checkedAt)}.`,
            }
          : { level: 'error', text: `Zählstellen nicht verfügbar: ${sites.error}.` },
      );
    }
  }

  if (mapProblem === 'tiles') {
    messages.push({ level: 'warning', text: de.map.tilesUnavailable });
  } else if (mapProblem === 'webgl') {
    messages.push({ level: 'error', text: de.map.webglUnavailable });
  }
  return messages;
}
