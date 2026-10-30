import { describe, expect, it } from 'vitest';
import { alignTokens } from './tokenDiff';
import { editedEntry, entryText } from './editEntry';
import { lineBreaks, presetEntriesToRefresh } from './presets';
import { tokenize } from './tokenize';
import type { Entry } from '../types';

const entryOf = (text: string, over: Partial<Entry> = {}): Entry => ({
  id: 'e1',
  createdAt: '2026-01-01T00:00:00Z',
  tokens: tokenize(text),
  ...over,
});

describe('alignTokens', () => {
  it('maps the words that survive an edit to their new positions', () => {
    const map = alignTokens(['a', 'b', 'c', 'd'], ['a', 'x', 'y', 'c', 'd']);
    expect([...map]).toEqual([
      [0, 0],
      [3, 4],
      [2, 3],
    ]);
    expect(map.has(1)).toBe(false);
  });
});

describe('entryText', () => {
  it('rebuilds readable text with paragraph and line breaks', () => {
    const text = 'Hi, I said "no way" today. It cost $15 (or so).\n\nYes!\nOkay.';
    const tokens = tokenize(text);
    expect(entryText(tokens, lineBreaks(text))).toBe(text);
  });
});

describe('editedEntry', () => {
  it('keeps marks, pins and exclusions on unchanged words and drops the rewritten ones', () => {
    // In theory , a dream come true .
    const entry = entryOf('In theory, a dream come true.', { pinned: [1, 4], excluded: [3] });
    const ranges = [0, 1, 4, 5, 6].map((i) => ({ start: i, end: i }));
    const { entry: next, ranges: nextRanges } = editedEntry(entry, ranges, 'In theory, a wish come true.\nReally.');
    expect(next.tokens).toEqual(tokenize('In theory, a wish come true. Really.'));
    expect(nextRanges.map((r) => next.tokens[r.start])).toEqual(['In', 'theory', 'come', 'true']);
    expect(next.pinned).toEqual([1]);
    expect(next.excluded).toEqual([3]);
    expect(next.edited).toBe(true);
    expect(next.breaks).toEqual([[7, false]]);
  });
});

describe('presetEntriesToRefresh', () => {
  it('leaves entries the user has edited alone', () => {
    const topics = [{ presetId: 'chunk-1', title: '1. Day 1', text: 'New {{text}} here.' }];
    const edited = entryOf('My own text.', { presetId: 'chunk-1', edited: true });
    const stale = entryOf('Old text.', { id: 'e2', presetId: 'chunk-1' });
    expect(presetEntriesToRefresh(topics, [edited, stale]).entries.map((e) => e.id)).toEqual(['e2']);
  });
});
