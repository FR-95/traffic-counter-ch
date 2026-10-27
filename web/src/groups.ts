import { FEDERAL_SOURCE } from '../../server/src/origin.ts';
import type { Counter } from '../../server/src/types.ts';

export interface OperatorGroup<T> {
  key: string;
  operator: string;
  items: T[];
}

export interface SourceGroup<T> {
  source: string;
  operators: OperatorGroup<T>[];
  total: number;
}

export const groupKey = ({ source, operator }: Pick<Counter, 'source' | 'operator'>) => `${source} › ${operator}`;

const byLabel = (a: string, b: string) => a.localeCompare(b, 'de');
const bySource = (a: string, b: string) => Number(b === FEDERAL_SOURCE) - Number(a === FEDERAL_SOURCE) || byLabel(a, b);

/** Gruppiert nach Quelle (Bund zuerst, dann Kantone) und darin nach Betreiber; Einträge nach Name sortiert. */
export function groupByOrigin<T extends { counter: Counter }>(items: T[]): SourceGroup<T>[] {
  const sources = new Map<string, Map<string, T[]>>();
  for (const item of items) {
    const { source, operator } = item.counter;
    const operators = sources.get(source) ?? new Map<string, T[]>();
    operators.set(operator, [...(operators.get(operator) ?? []), item]);
    sources.set(source, operators);
  }

  return [...sources]
    .sort(([a], [b]) => bySource(a, b))
    .map(([source, operators]) => {
      const groups = [...operators]
        .sort(([a], [b]) => byLabel(a, b))
        .map(([operator, entries]) => ({
          key: groupKey({ source, operator }),
          operator,
          items: entries.sort((a, b) => byLabel(a.counter.name, b.counter.name)),
        }));
      return { source, operators: groups, total: groups.reduce((sum, group) => sum + group.items.length, 0) };
    });
}
