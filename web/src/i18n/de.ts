// Alle sichtbaren Texte des Web-Clients. Noch nicht migriert: traffic.ts, status.ts, useTrafficData.ts,
// TrafficMap.tsx und Texte vom Server (siehe docs/agents/open-items.md).

export const de = {
  brand: {
    logoAlt: 'Intersys',
    toolName: 'Verkehrszähler Schweiz',
  },
  page: {
    title: 'Verkehrslage',
    loading: 'Messwerte werden geladen …',
    measuredAt: (time: string) => `Stand ${time}`,
    counterCount: (count: number) => `${count} Zählstellen`,
    source: 'Daten',
    sourceSuffix: '(ASTRA, minütlich aktualisiert)',
  },
  notice: {
    error: 'Fehler',
    warning: 'Hinweis',
    info: 'Hinweis',
  },
  search: {
    label: 'Zählstelle suchen',
    hint: 'Ort, Strasse, Nummer oder Betreiber, mindestens 2 Zeichen',
    empty: 'Keine Zählstelle gefunden. Versuchen Sie einen anderen Ort, eine Strasse oder eine Nummer.',
  },
  statusFilter: {
    legend: 'Lage',
    sizeHint: 'Kreisgrösse = Fahrzeuge pro Stunde',
  },
  groups: {
    legend: 'Quelle und Betreiber',
    hint: 'Herkunft laut Zählstellen-ID. Abgewählte Gruppen werden auf der Karte ausgeblendet.',
    showCounters: (operator: string) => `Zählstellen von ${operator} anzeigen`,
    hideCounters: (operator: string) => `Zählstellen von ${operator} ausblenden`,
  },
  details: {
    close: 'Schliessen',
    empty: 'Wählen Sie eine Zählstelle auf der Karte, in der Suche oder in der Liste, um Messwerte pro Fahrstreifen zu sehen.',
    locationExact: 'Standort exakt (ASTRA-Sensoren)',
    locationPartlyExact: 'Standort teilweise exakt',
    locationComputed: 'Standort berechnet (ca. 100–500 m genau)',
    vehicles: 'Fahrzeuge',
    averageSpeed: 'Ø Geschwindigkeit',
    perHour: 'pro Stunde',
    withoutRamps: 'Summe und Durchschnitt ohne Ein- und Ausfahrten.',
    towards: (places: string) => `Richtung ${places}`,
    lane: 'Fahrstreifen',
    cars: 'Personenwagen',
    lorries: 'Lastwagen',
    missing: '–',
  },
  units: {
    vehiclesPerHour: 'Fz/h',
    kmh: 'km/h',
  },
} as const;
