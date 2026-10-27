// Herkunft einer Zählstelle aus dem ID-Präfix: "[Betreiber.]Kanton.CH:Nummer".
// "CH:0542" = ASTRA, "ZH.CH:0088" = Kanton Zürich, "FH.FR.CH:0001" = Betreiber "FH" im Kanton Freiburg.

export const FEDERAL_SOURCE = 'Bund';
const FEDERAL_OPERATOR = 'ASTRA';

const CANTONS: Record<string, string> = {
  AG: 'Aargau',
  AI: 'Appenzell Innerrhoden',
  AR: 'Appenzell Ausserrhoden',
  BE: 'Bern',
  BL: 'Basel-Landschaft',
  BS: 'Basel-Stadt',
  FR: 'Freiburg',
  GE: 'Genf',
  GL: 'Glarus',
  GR: 'Graubünden',
  JU: 'Jura',
  LU: 'Luzern',
  NE: 'Neuenburg',
  NW: 'Nidwalden',
  OW: 'Obwalden',
  SG: 'St. Gallen',
  SH: 'Schaffhausen',
  SO: 'Solothurn',
  SZ: 'Schwyz',
  TG: 'Thurgau',
  TI: 'Tessin',
  UR: 'Uri',
  VD: 'Waadt',
  VS: 'Wallis',
  ZG: 'Zug',
  ZH: 'Zürich',
};

export interface Origin {
  /** "Bund" oder "Kanton …" */
  source: string;
  /** "ASTRA", "Kanton …" oder das Kürzel aus der ID, wenn kein Name bekannt ist */
  operator: string;
  /** Kantonskürzel aus dem Präfix, null bei ASTRA-Zählstellen */
  canton: string | null;
}

const cantonLabel = (code: string) => (CANTONS[code] ? `Kanton ${CANTONS[code]}` : `Kanton ${code}`);

export function originOf(counterId: string): Origin {
  const prefix = counterId.includes(':') ? counterId.slice(0, counterId.indexOf(':')) : '';
  const parts = prefix.split('.').filter(Boolean);
  if (parts.at(-1) === 'CH') parts.pop();

  const canton = parts.pop();
  if (!canton) return { source: FEDERAL_SOURCE, operator: FEDERAL_OPERATOR, canton: null };

  const source = cantonLabel(canton);
  return { source, operator: parts.length > 0 ? parts.join('.') : source, canton };
}
