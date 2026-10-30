import { describe, expect, it } from 'vitest';
import {
  allQuestions,
  answerOptions,
  estimatedBand,
  isCorrect,
  isWritten,
  loadResults,
  marksFor,
  normalizeAnswer,
  PASSAGES,
  saveResult,
  score,
  splitKeys,
  totalMarks,
  type ReadingQuestion,
} from './reading';

describe('reading passages', () => {
  it('gives every passage a unique id', () => {
    const ids = PASSAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of [...Array(10).keys()]) expect(ids).toContain(`r${String(i + 1).padStart(2, '0')}`);
  });

  it('covers every question type', () => {
    const types = new Set(PASSAGES.flatMap((p) => p.groups.map((g) => g.type)));
    expect([...types].sort()).toEqual(
      ['completion', 'endings', 'headings', 'matching', 'mcq', 'mcq2', 'paragraph', 'short', 'tfng', 'wordlist', 'ynng'].sort(),
    );
  });

  for (const p of PASSAGES) {
    describe(p.title, () => {
      const labels = p.paragraphs.map((x) => x.label);
      const text = p.paragraphs.map((x) => x.text).join(' ').toLowerCase();

      it('numbers the questions from 1 without gaps and is worth 13 marks', () => {
        let next = 1;
        for (const q of allQuestions(p)) {
          expect(q.num).toBe(next);
          next += q.count ?? 1;
        }
        expect(totalMarks(p)).toBe(13);
      });

      it('has an answer among the options and evidence in a real paragraph', () => {
        for (const g of p.groups)
          for (const q of g.questions) {
            expect(labels, `${q.num}`).toContain(q.evidence);
            expect(q.explanation.length, `${q.num}`).toBeGreaterThan(10);
            if (isWritten(g.type)) {
              expect(q.accept?.length, `${q.num}`).toBeGreaterThan(0);
              for (const a of q.accept!) expect(text, `${q.num}: ${a}`).toContain(a.toLowerCase());
            } else {
              const keys = splitKeys(q.answer);
              expect(keys, `${q.num}`).toHaveLength(q.count ?? 1);
              for (const k of keys) expect(answerOptions(p, g, q), `${q.num}`).toContain(k);
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

  it('gives one mark per correct letter in a choose-two question', () => {
    const q: ReadingQuestion = { num: 1, count: 2, text: '', answer: 'B,D', evidence: 'A', explanation: '' };
    expect(marksFor(q, 'B,D')).toBe(2);
    expect(marksFor(q, 'A,D')).toBe(1);
    expect(isCorrect(q, 'A,D')).toBe(false);
    expect(marksFor(q, undefined)).toBe(0);
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
