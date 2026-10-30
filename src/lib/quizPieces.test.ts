import { describe, expect, it } from 'vitest';
import { buildQuizPieces } from './quizPieces';

describe('buildQuizPieces', () => {
  it('splits text around a single blank range', () => {
    const tokens = ['I', 'will', 'come', 'up', 'with', 'a', 'plan', '.'];
    const pieces = buildQuizPieces(tokens, [{ start: 2, end: 4 }]);
    expect(pieces).toEqual([
      { type: 'text', text: 'I will', leadsWithWord: true, start: 0, end: 1 },
      { type: 'blank', rangeIndex: 0, label: 'come up with' },
      { type: 'text', text: 'a plan.', leadsWithWord: true, start: 5, end: 7 },
    ]);
  });

  it('handles a blank at the very start of the text', () => {
    const tokens = ['Hello', ',', 'world', '.'];
    const pieces = buildQuizPieces(tokens, [{ start: 0, end: 0 }]);
    expect(pieces[0]).toEqual({ type: 'blank', rangeIndex: 0, label: 'Hello' });
  });

  it('handles multiple blanks with punctuation immediately after one of them', () => {
    const tokens = ['wait', ',', 'really', '?'];
    const pieces = buildQuizPieces(tokens, [{ start: 0, end: 0 }, { start: 2, end: 2 }]);
    expect(pieces).toEqual([
      { type: 'blank', rangeIndex: 0, label: 'wait' },
      { type: 'text', text: ',', leadsWithWord: false, start: 1, end: 1 },
      { type: 'blank', rangeIndex: 1, label: 'really' },
      { type: 'text', text: '?', leadsWithWord: false, start: 3, end: 3 },
    ]);
  });
});
