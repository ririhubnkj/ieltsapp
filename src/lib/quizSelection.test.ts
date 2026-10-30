import { describe, expect, it } from 'vitest';
import { tokenize } from './tokenize';
import {
  blankCandidates,
  blankCount,
  pickBlanks,
  pickQuizRanges,
  quizCandidates,
  quizCount,
} from './quizSelection';
import type { MarkingRange } from '../types';

describe('pickQuizRanges', () => {
  it('returns an empty array when there are no markings', () => {
    expect(pickQuizRanges([], 0.5)).toEqual([]);
  });

  it('returns an empty array when there are no markings even at ratio 1', () => {
    expect(pickQuizRanges([], 1)).toEqual([]);
  });

  it('always selects at least one range when ratio rounds to zero', () => {
    const ranges: MarkingRange[] = [{ start: 0, end: 0 }, { start: 1, end: 1 }];
    const result = pickQuizRanges(ranges, 0.1, () => 0);
    expect(result).toHaveLength(1);
  });

  it('never selects more than the total number of markings', () => {
    const ranges: MarkingRange[] = [{ start: 0, end: 0 }];
    const result = pickQuizRanges(ranges, 1, () => 0.9);
    expect(result).toHaveLength(1);
  });

  it('selects the single available range when n=1 regardless of ratio', () => {
    const ranges: MarkingRange[] = [{ start: 3, end: 5 }];
    expect(pickQuizRanges(ranges, 0.01, () => 0)).toEqual([{ start: 3, end: 5 }]);
  });

  it('produces a deterministic selection with an injected rng', () => {
    const ranges: MarkingRange[] = [
      { start: 0, end: 0 },
      { start: 1, end: 1 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
    ];
    const rng = () => 0;
    const result = pickQuizRanges(ranges, 0.5, rng);
    expect(result).toHaveLength(2);
  });

  it('never returns duplicate ranges', () => {
    const ranges: MarkingRange[] = [
      { start: 0, end: 0 },
      { start: 1, end: 1 },
      { start: 2, end: 2 },
    ];
    const result = pickQuizRanges(ranges, 1, Math.random);
    const starts = result.map((r) => r.start);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('sorts the selection by appearance order in the text', () => {
    const ranges: MarkingRange[] = [
      { start: 0, end: 0 },
      { start: 5, end: 5 },
      { start: 10, end: 10 },
    ];
    const result = pickQuizRanges(ranges, 1, Math.random);
    const starts = result.map((r) => r.start);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });
});

describe('quizCandidates', () => {
  const tokens = ['Keep', 'up', 'with', 'it', ',', 'please', '.'];

  it('uses every word token (not punctuation) in allWords mode', () => {
    expect(quizCandidates(tokens, [], 'allWords').map((r) => r.start)).toEqual([0, 1, 2, 3, 5]);
  });

  it('splits marked ranges into single-word ranges in marked mode', () => {
    expect(quizCandidates(tokens, [{ start: 0, end: 2 }], 'marked')).toEqual([
      { start: 0, end: 0 },
      { start: 1, end: 1 },
      { start: 2, end: 2 },
    ]);
  });

  it('skips punctuation inside marked ranges and dedupes overlaps', () => {
    expect(quizCandidates(tokens, [{ start: 3, end: 5 }, { start: 5, end: 5 }], 'marked')).toEqual([
      { start: 3, end: 3 },
      { start: 5, end: 5 },
    ]);
  });
});

describe('quizCount', () => {
  it('applies the ratio in 10% steps with at least one blank', () => {
    expect(quizCount(50, 0.3)).toBe(15);
    expect(quizCount(3, 0.1)).toBe(1);
    expect(quizCount(0, 0.5)).toBe(0);
  });
});

describe('pickBlanks', () => {
  const candidates: MarkingRange[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ start: i, end: i }));

  it('always includes pinned spots, even when the ratio is low', () => {
    const result = pickBlanks(candidates, [3, 7], 0.1, Math.random).map((r) => r.start);
    expect(result).toEqual([3, 7]);
  });

  it('fills the rest randomly up to the ratio', () => {
    const result = pickBlanks(candidates, [3], 0.5, Math.random).map((r) => r.start);
    expect(result).toHaveLength(5);
    expect(result).toContain(3);
    expect(new Set(result).size).toBe(5);
  });

  it('includes pinned spots outside the current candidates', () => {
    expect(pickBlanks([], [4], 0.5).map((r) => r.start)).toEqual([4]);
  });
});

describe('blankCount', () => {
  it('never drops below the number of pinned spots', () => {
    const candidates: MarkingRange[] = [0, 1, 2, 3].map((i) => ({ start: i, end: i }));
    expect(blankCount(candidates, [0, 1, 2], 0.1)).toBe(3);
    expect(blankCount(candidates, [], 0.5)).toBe(2);
  });
});

describe('blankCandidates', () => {
  const tokens = ['The', 'cat', 'is', 'small', 'and', 'a', 'dog', 'was', 'here', '.'];

  it('leaves out articles, be verbs and and while the ratio is under 100%', () => {
    expect(blankCandidates(tokens, [], 'allWords', 0.5).map((r) => r.start)).toEqual([1, 3, 6, 8]);
  });

  it('includes them at 100%', () => {
    expect(blankCandidates(tokens, [], 'allWords', 1).map((r) => r.start)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('keeps a skipped word that was pinned by hand', () => {
    expect(blankCandidates(tokens, [], 'allWords', 0.5, { pinned: [2] }).map((r) => r.start)).toEqual([
      1, 2, 3, 6, 8,
    ]);
  });

  it('leaves out linking adverbs and frequency adverbs', () => {
    const adverbs = ['However', ',', 'people', 'often', 'travel', '.', 'Moreover', ',', 'they', 'rarely', 'rest', '.'];
    expect(blankCandidates(adverbs, [], 'allWords', 0.5).map((r) => adverbs[r.start])).toEqual([
      'people',
      'travel',
      'rest',
    ]);
  });

  it('leaves out modal verbs, including contracted ones', () => {
    const modals = ['They', 'should', 'go', 'but', 'they', "won't", 'wait', '.'];
    expect(blankCandidates(modals, [], 'allWords', 0.5).map((r) => modals[r.start])).toEqual([
      'go',
      'wait',
    ]);
  });

  it('treats a curly apostrophe like a straight one', () => {
    const curly = ['She', 'won’t', 'wait', '.'];
    expect(blankCandidates(curly, [], 'allWords', 0.5).map((r) => curly[r.start])).toEqual(['wait']);
  });

  it('leaves out prepositions but keeps phrasal-verb particles', () => {
    const phrase = ['She', 'looked', 'up', 'the', 'word', 'in', 'a', 'dictionary', 'at', 'home', '.'];
    expect(blankCandidates(phrase, [], 'allWords', 0.5).map((r) => phrase[r.start])).toEqual([
      'looked',
      'up',
      'word',
      'dictionary',
      'home',
    ]);
  });

  it('keeps every marked word, even a be verb or an article', () => {
    expect(blankCandidates(tokens, [{ start: 0, end: 3 }], 'marked', 0.5).map((r) => r.start)).toEqual([
      0, 1, 2, 3,
    ]);
  });

  it('drops excluded words in both modes and at 100%', () => {
    expect(blankCandidates(tokens, [], 'allWords', 1, { excluded: [1] }).map((r) => r.start)).toEqual([
      0, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(blankCandidates(tokens, [{ start: 0, end: 3 }], 'marked', 0.5, { excluded: [1] }).map((r) => r.start)).toEqual([
      0, 2, 3,
    ]);
  });
});

describe('pronouns, conjunctions and essay templates', () => {
  const words = (tokens: string[], rs: { start: number }[]) => rs.map((r) => tokens[r.start]);

  it('leaves out pronouns and conjunctions under 100%', () => {
    const tokens = tokenize("They said it's cheap , but I doubt that because their data is old .");
    expect(words(tokens, blankCandidates(tokens, [], 'allWords', 0.5))).toEqual(['said', 'cheap', 'doubt', 'data', 'old']);
  });

  it('never blanks the essay template when asked, even at 100%', () => {
    const tokens = tokenize('Some might claim that X helps. However, others assert that Y hurts. For instance, Z.');
    const got = words(tokens, blankCandidates(tokens, [], 'allWords', 1, { skipTemplates: true }));
    expect(got).toEqual(['X', 'helps', 'Y', 'hurts', 'Z']);
  });

  it('keeps Task 1 figures out of the blanks along with the template', () => {
    const tokens = tokenize('It rose from 8.3 to 12,539 in 2020, which was high.');
    const got = words(tokens, blankCandidates(tokens, [], 'allWords', 1, { skipTemplates: true }));
    expect(got).toEqual(['It', 'rose', 'from', 'to', 'in', 'which', 'was', 'high']);
  });

  it('still blanks a pinned template word', () => {
    const tokens = tokenize('Some might claim that X helps.');
    const got = words(tokens, blankCandidates(tokens, [], 'allWords', 1, { skipTemplates: true, pinned: [2] }));
    expect(got).toEqual(['claim', 'X', 'helps']);
  });
});
