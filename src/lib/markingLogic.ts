import type { MarkingRange } from '../types';

export function toggleWordMarking(ranges: MarkingRange[], tapped: number): MarkingRange[] {
  const covering = ranges.find((r) => tapped >= r.start && tapped <= r.end);
  if (!covering) {
    return [...ranges, { start: tapped, end: tapped }].sort((a, b) => a.start - b.start);
  }

  const split: MarkingRange[] = [];
  if (covering.start < tapped) split.push({ start: covering.start, end: tapped - 1 });
  if (tapped < covering.end) split.push({ start: tapped + 1, end: covering.end });

  return [...ranges.filter((r) => r !== covering), ...split].sort((a, b) => a.start - b.start);
}

export function isMarked(ranges: MarkingRange[], index: number): boolean {
  return ranges.some((r) => index >= r.start && index <= r.end);
}
