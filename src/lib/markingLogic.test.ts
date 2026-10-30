import { describe, expect, it } from 'vitest';
import { isMarked, toggleWordMarking } from './markingLogic';

describe('toggleWordMarking', () => {
  it('marks a single word on tap', () => {
    expect(toggleWordMarking([], 5)).toEqual([{ start: 5, end: 5 }]);
  });

  it('marks adjacent words as separate single-word ranges', () => {
    const once = toggleWordMarking([], 5);
    expect(toggleWordMarking(once, 6)).toEqual([
      { start: 5, end: 5 },
      { start: 6, end: 6 },
    ]);
  });

  it('unmarks a single-word marking on re-tap', () => {
    expect(toggleWordMarking([{ start: 5, end: 5 }], 5)).toEqual([]);
  });

  it('removes only the tapped word from a legacy multi-word range', () => {
    expect(toggleWordMarking([{ start: 2, end: 4 }], 3)).toEqual([
      { start: 2, end: 2 },
      { start: 4, end: 4 },
    ]);
  });

  it('trims the edge of a legacy multi-word range', () => {
    expect(toggleWordMarking([{ start: 2, end: 4 }], 2)).toEqual([{ start: 3, end: 4 }]);
  });

  it('leaves other markings untouched', () => {
    const ranges = [{ start: 2, end: 2 }, { start: 10, end: 10 }];
    expect(toggleWordMarking(ranges, 2)).toEqual([{ start: 10, end: 10 }]);
  });

  it('keeps ranges sorted by start position', () => {
    expect(toggleWordMarking([{ start: 10, end: 10 }], 0)).toEqual([
      { start: 0, end: 0 },
      { start: 10, end: 10 },
    ]);
  });
});

describe('isMarked', () => {
  it('detects indices inside any range', () => {
    const ranges = [{ start: 2, end: 4 }];
    expect(isMarked(ranges, 3)).toBe(true);
    expect(isMarked(ranges, 5)).toBe(false);
  });
});
