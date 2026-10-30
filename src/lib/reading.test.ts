import { describe, expect, it } from 'vitest';
import {
  allQuestions,
  answerOptions,
  estimatedBand,
  isCorrect,
  loadResults,
  normalizeAnswer,
  PASSAGES,
  saveResult,
  score,
} from './reading';

describe('reading passages', () => {
  it('bundles the passages in file order', () => {
    expect(PASSAGES.map((p) => p.id)).toEqual(['r01', 'r02', 'r03', 'r04']);
  });

  for (const p of PASSAGES) {
    describe(p.title, () => {
      const labels = p.paragraphs.map((x) => x.label);
      const text = p.paragraphs.map((x) => x.text).join(' ').toLowerCase();

      it('numbers the questions from 1 without gaps', () => {
        expect(allQuestions(p).map((q) => q.num)).toEqual(allQuestions(p).map((_, i) => i + 1));
      });

      it('has an answer among the options and evidence in a real paragraph', () => {
        for (const g of p.groups)
          for (const q of g.questions) {
            expect(labels, `${q.num}`).toContain(q.evidence);
            expect(q.explanation.length, `${q.num}`).toBeGreaterThan(10);
            if (g.type === 'completion') {
              expect(q.accept?.length, `${q.num}`).toBeGreaterThan(0);
              for (const a of q.accept!) expect(text, `${q.num}: ${a}`).toContain(a.toLowerCase());
            } else {
              expect(answerOptions(p, g, q), `${q.num}`).toContain(q.answer);
            }
          }
      });
    });
  }
});

describe('grading', () => {
  const passage = PASSAGES[0]!;
  const key = Object.fromEntries(
    allQuestions(passage).map((q) => [q.num, q.answer ?? q.accept![0]!.toUpperCase() + '.']),
  );

  it('accepts written answers regardless of case, punctuation and a leading article', () => {
    expect(normalizeAnswer('  The Green  Roofs. ')).toBe('green roofs');
    expect(score(passage, key)).toBe(allQuestions(passage).length);
  });

  it('counts blank answers as wrong', () => {
    expect(isCorrect(allQuestions(passage)[0]!, undefined)).toBe(false);
    expect(score(passage, {})).toBe(0);
  });

  it('converts the score to an approximate band out of 40 questions', () => {
    expect(estimatedBand(13, 13)).toBe(9);
    expect(estimatedBand(9, 13)).toBe(6.5);
    expect(estimatedBand(0, 13)).toBeNull();
  });

  it('keeps the best and the last score', () => {
    saveResult('r-test', 8, 13);
    saveResult('r-test', 5, 13);
    expect(loadResults()['r-test']).toMatchObject({ best: 8, last: 5, attempts: 2, total: 13 });
  });
});
