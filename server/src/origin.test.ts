import { describe, expect, it } from 'vitest';
import { originOf } from './origin.ts';

describe('originOf', () => {
  it('ordnet Zählstellen ohne Kantonspräfix dem ASTRA zu', () => {
    expect(originOf('CH:0542')).toEqual({ source: 'Bund', operator: 'ASTRA', canton: null });
  });

  it('nutzt den Kanton als Quelle und Betreiber', () => {
    expect(originOf('ZH.CH:0088')).toEqual({ source: 'Kanton Zürich', operator: 'Kanton Zürich', canton: 'ZH' });
    expect(originOf('BE.CH:2102')).toEqual({ source: 'Kanton Bern', operator: 'Kanton Bern', canton: 'BE' });
  });

  it('übernimmt einen eigenen Betreiber vor dem Kanton', () => {
    expect(originOf('FH.FR.CH:0001')).toEqual({ source: 'Kanton Freiburg', operator: 'FH', canton: 'FR' });
  });

  it('zeigt unbekannte Kantonskürzel unverändert', () => {
    expect(originOf('XY.CH:0001').source).toBe('Kanton XY');
  });
});
