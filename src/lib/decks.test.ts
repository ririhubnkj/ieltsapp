import { describe, expect, it } from 'vitest';
import { DEFAULT_DECKS, deckIdOf, withNewDefaultDecks } from './decks';
import type { Entry } from '../types';

const entry = (over: Partial<Entry>): Entry => ({ id: 'x', createdAt: '2026-01-01T00:00:00Z', tokens: [], ...over });

describe('deckIdOf', () => {
  it('uses the stored tab when it still exists', () => {
    expect(deckIdOf(entry({ deckId: 'ielts-task1' }), DEFAULT_DECKS)).toBe('ielts-task1');
  });

  it('puts untagged Task 1 presets into the Task 1 tab and everything else into the first tab', () => {
    expect(deckIdOf(entry({ presetId: 'task1-3' }), DEFAULT_DECKS)).toBe('ielts-task1');
    expect(deckIdOf(entry({ presetId: 'topic-3' }), DEFAULT_DECKS)).toBe('ielts-task2');
    expect(deckIdOf(entry({}), DEFAULT_DECKS)).toBe('ielts-task2');
  });

  it('puts untagged Chunk and Idiomatic 300 presets into their own tabs', () => {
    expect(deckIdOf(entry({ presetId: 'chunk-4' }), DEFAULT_DECKS)).toBe('chunk-taizen');
    expect(deckIdOf(entry({ presetId: 'idiomatic300-12' }), DEFAULT_DECKS)).toBe('idiomatic-300');
  });

  it('falls back to the first tab when the stored tab was deleted', () => {
    expect(deckIdOf(entry({ deckId: 'gone' }), DEFAULT_DECKS)).toBe('ielts-task2');
  });
});

describe('withNewDefaultDecks', () => {
  it('adds default tabs that did not exist when the tabs were saved', () => {
    const saved = [{ id: 'ielts-task2', name: 'Essay' }, { id: 'ielts-task1', name: 'Report' }];
    expect(withNewDefaultDecks(saved, ['ielts-task2', 'ielts-task1']).map((d) => d.id)).toEqual([
      'ielts-task2',
      'ielts-task1',
      'toefl-email',
      'chunk-taizen',
      'idiomatic-300',
    ]);
  });

  it('does not bring back a default tab the user deleted', () => {
    const saved = [{ id: 'ielts-task2', name: 'Essay' }];
    expect(withNewDefaultDecks(saved, ['ielts-task2', 'ielts-task1', 'toefl-email', 'chunk-taizen', 'idiomatic-300'])).toBe(saved);
  });
});
