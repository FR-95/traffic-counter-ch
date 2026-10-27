import { describe, expect, it } from 'vitest';
import { applyAssessment, areaOf, assess, assessMinute } from './congestion.ts';
import type { TmcLocation } from './tmc.ts';
import type { CounterValues, MeasurementsResponse } from './types.ts';

const minute = (worstSpeed: number | null, worstFlow: number | null = 600, flow = worstFlow): CounterValues => ({
  flow,
  speed: worstSpeed,
  worstSpeed,
  worstFlow,
  countedLanes: 2,
  failedLanes: 0,
  lanes: {},
  errors: [],
  status: 'free',
  statusHint: null,
});

describe('assessMinute (ASTRA ausserorts)', () => {
  it('stuft nach der langsameren Richtung ein', () => {
    expect(assessMinute(minute(9)).status).toBe('jam');
    expect(assessMinute(minute(10)).status).toBe('slow');
    expect(assessMinute(minute(29)).status).toBe('slow');
    expect(assessMinute(minute(30)).status).toBe('free');
  });

  it('wertet ein oder zwei Fahrzeuge pro Minute nicht als Stau', () => {
    expect(assessMinute(minute(5, 120))).toEqual({ status: 'free', statusHint: 'lowTraffic' });
    expect(assessMinute(minute(5, 180)).status).toBe('jam');
  });

  it('unterscheidet leere Strasse und fehlende Daten', () => {
    expect(assessMinute(minute(null, null, 0)).status).toBe('free');
    expect(assessMinute(minute(null, null, null)).status).toBe('nodata');
    expect(assessMinute(undefined).status).toBe('nodata');
  });
});

describe('assess', () => {
  it('ausserorts genügt eine Minute', () => {
    expect(assess([minute(80), minute(5)], false, 'rural').status).toBe('jam');
    expect(assess([minute(5)], false, null).status).toBe('jam');
  });

  it('innerorts erst nach 5 Minuten am Stück', () => {
    const slow = [minute(20), minute(8), minute(8), minute(8), minute(8)];
    expect(assess(slow, true, 'urban')).toEqual({ status: 'slow', statusHint: null });
    expect(assess(slow.map(() => minute(8)), true, 'urban').status).toBe('jam');
    expect(assess(slow, false, 'urban')).toEqual({ status: 'free', statusHint: 'urbanPending' });
    expect(assess([minute(40), ...slow.slice(1)], true, 'urban')).toEqual({ status: 'free', statusHint: 'urbanPending' });
    expect(assess([...slow.slice(0, 4), undefined, minute(8)], true, 'urban').statusHint).toBe('urbanPending');
  });
});

describe('areaOf', () => {
  const at = (roadClass: string | null, pointType: string | null): TmcLocation => ({
    name: '',
    road: null,
    lat: null,
    lng: null,
    negative: null,
    positive: null,
    roadClass,
    pointType,
  });

  it('leitet innerorts aus Stadtstrasse oder Knoten ab', () => {
    expect(areaOf(at('L1.1', 'P1.11'))).toBe('rural');
    expect(areaOf(at('L5.0', 'P3.37'))).toBe('urban');
    expect(areaOf(at('L1.2', 'P1.11'))).toBe('urban');
    expect(areaOf(at('L1.2', 'P3.37'))).toBe('rural');
    expect(areaOf(at(null, null))).toBeNull();
    expect(areaOf(undefined)).toBeNull();
  });
});

describe('applyAssessment', () => {
  const at = (time: string, speed: number): MeasurementsResponse => ({
    publicationTime: time,
    measurementTime: time,
    counters: { A: minute(speed), B: minute(speed) },
  });
  const areas = new Map([
    ['A', 'urban' as const],
    ['B', 'rural' as const],
  ]);

  it('hält den Verlauf der letzten 5 Minuten und wendet die Regel pro Zählstelle an', () => {
    let history: MeasurementsResponse[] = [];
    for (const time of ['10:00', '10:01', '10:02', '10:03']) {
      history = applyAssessment(at(`2026-10-27T${time}:00Z`, 8), history, areas);
    }
    expect(history.at(-1)?.counters.A?.status).toBe('free');
    expect(history.at(-1)?.counters.B?.status).toBe('jam');

    history = applyAssessment(at('2026-10-27T10:04:00Z', 8), history, areas);
    expect(history).toHaveLength(5);
    expect(history.at(-1)?.counters.A?.status).toBe('jam');

    history = applyAssessment(at('2026-10-27T10:05:00Z', 8), history, areas);
    expect(history.map((entry) => entry.measurementTime?.slice(11, 16))).toEqual(['10:01', '10:02', '10:03', '10:04', '10:05']);
  });

  it('ersetzt einen erneut gelieferten Zeitpunkt statt ihn doppelt zu zählen', () => {
    const first = applyAssessment(at('2026-10-27T10:00:00Z', 8), [], areas);
    expect(applyAssessment(at('2026-10-27T10:00:00Z', 8), first, areas)).toHaveLength(1);
  });
});
