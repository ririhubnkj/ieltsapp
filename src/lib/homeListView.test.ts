import { describe, expect, it } from 'vitest';
import { filterAndSortEntries } from './homeListView';
import type { Entry, SessionRecord } from '../types';

const entries: Entry[] = [
  { id: 'e1', createdAt: 't1', tokens: ['Hello', 'world'], title: 'Greeting' },
  { id: 'e2', createdAt: 't2', tokens: ['Business', 'email'] },
  { id: 'e3', createdAt: 't3', tokens: ['Chapter', 'three'], title: 'Dialogue' },
];

const sessions: SessionRecord[] = [
  { id: 's1', entryId: 'e1', timestamp: '2026-01-01', totalQuestions: 4, correctCount: 4 },
  { id: 's2', entryId: 'e2', timestamp: '2026-01-03', totalQuestions: 4, correctCount: 1 },
];

describe('filterAndSortEntries', () => {
  it('returns all entries in original order for an empty query and registered sort', () => {
    const rows = filterAndSortEntries(entries, sessions, '', 'registered');
    expect(rows.map((r) => r.entry.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('matches by title case-insensitively', () => {
    const rows = filterAndSortEntries(entries, sessions, 'greet', 'registered');
    expect(rows.map((r) => r.entry.id)).toEqual(['e1']);
  });

  it('matches by body text when no title matches', () => {
    const rows = filterAndSortEntries(entries, sessions, 'business', 'registered');
    expect(rows.map((r) => r.entry.id)).toEqual(['e2']);
  });

  it('returns no rows when nothing matches', () => {
    const rows = filterAndSortEntries(entries, sessions, 'nonexistent', 'registered');
    expect(rows).toEqual([]);
  });

  it('sorts by most-recently-studied first, with never-studied entries last', () => {
    const rows = filterAndSortEntries(entries, sessions, '', 'lastStudied');
    expect(rows.map((r) => r.entry.id)).toEqual(['e2', 'e1', 'e3']);
  });
});
