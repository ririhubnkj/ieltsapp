import { describe, expect, it } from 'vitest';
import { adjacentEntries } from './adjacentEntries';
import type { Entry } from '../types';

const entry = (id: string): Entry => ({ id, createdAt: '2026-01-01T00:00:00.000Z', tokens: ['a'] });
const entries = [entry('a'), entry('b'), entry('c')];

describe('adjacentEntries', () => {
  it('returns neighbours in the middle', () => {
    const r = adjacentEntries(entries, 'b');
    expect(r.prev?.id).toBe('a');
    expect(r.next?.id).toBe('c');
    expect(r.position).toBe(1);
    expect(r.total).toBe(3);
  });

  it('has no prev at the start and no next at the end', () => {
    expect(adjacentEntries(entries, 'a').prev).toBeNull();
    expect(adjacentEntries(entries, 'c').next).toBeNull();
  });

  it('returns nothing when the entry is not in the list', () => {
    const r = adjacentEntries(entries, 'x');
    expect(r).toEqual({ prev: null, next: null, position: -1, total: 3 });
  });
});
