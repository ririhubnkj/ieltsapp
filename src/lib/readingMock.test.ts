import { beforeEach, describe, expect, it } from 'vitest';
import { levelOfPassageId, type LevelId } from './levels';
import { allQuestions, PASSAGES, passagesForLevel, totalMarks, type ReadingPassage } from './reading';
import {
  displayLabel,
  formatClock,
  isNumberAnswered,
  loadMockHistory,
  mockBand,
  mockNumbers,
  mockScore,
  mockTotalMarks,
  pickMockPassages,
  questionOffsets,
  renumberInstructions,
  saveMockRecord,
  sortByLevel,
  typeAccuracy,
} from './readingMock';

/** 決まった順の乱数(テストで結果を固定する) */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 全問正解の答え */
function fullAnswers(p: ReadingPassage): Record<number, string> {
  return Object.fromEntries(allQuestions(p).map((q) => [q.num, q.answer ?? q.accept![0]!]));
}

describe('pickMockPassages', () => {
  it('picks 3 different passages', () => {
    for (const level of ['l1', 'l2', 'l3', 'l4', 'l5'] as LevelId[]) {
      const picked = pickMockPassages(level, seeded(7));
      expect(picked).toHaveLength(3);
      expect(new Set(picked.map((p) => p.id)).size).toBe(3);
    }
  });

  it('uses only the chosen level when it has enough passages', () => {
    for (const level of ['l1', 'l2', 'l3', 'l4', 'l5'] as LevelId[]) {
      if (passagesForLevel(level).length < 3) continue;
      const picked = pickMockPassages(level, seeded(3));
      for (const p of picked) expect(levelOfPassageId(p.id)).toBe(level);
    }
  });

  it('fills from the neighbouring levels when the level has fewer than 3', () => {
    const pool = PASSAGES.filter((p) => ['l2-r01', 'r01', 'r02', 'r05', 'l5-r01', 'l1-r01'].includes(p.id));
    // l2 は1題だけ。足りない2題は1つ隣の l1・l3 から取り、2つ隣の l4 は使わない
    const picked = pickMockPassages('l2', seeded(5), pool);
    const ids = picked.map((p) => p.id);
    expect(ids).toContain('l2-r01');
    expect(ids).not.toContain('r05');
    expect(ids).not.toContain('l5-r01');
    // l5 は1題だけ。隣の l4 の1題、その次に l3 から足す
    const top = pickMockPassages('l5', seeded(5), pool).map((p) => p.id);
    expect(top).toContain('l5-r01');
    expect(top).toContain('r05');
    expect(top).toHaveLength(3);
  });

  it('puts easier levels first', () => {
    const picked = pickMockPassages('l5', seeded(2));
    const order = ['l1', 'l2', 'l3', 'l4', 'l5'];
    const idx = picked.map((p) => order.indexOf(levelOfPassageId(p.id)));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    const resorted = sortByLevel([...picked].reverse()).map((p) => order.indexOf(levelOfPassageId(p.id)));
    expect(resorted).toEqual(idx);
  });

  it('can give a different set with another random sequence', () => {
    const sets = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => pickMockPassages('l4', seeded(s)).map((p) => p.id).join()));
    expect(sets.size).toBeGreaterThan(1);
  });
});

describe('numbering', () => {
  const passages = PASSAGES.slice(0, 3);

  it('numbers the questions 1–39 across the 3 passages', () => {
    expect(questionOffsets(passages)).toEqual([0, 13, 26]);
    expect(mockTotalMarks(passages)).toBe(39);
    const nums = mockNumbers(passages, [{}, {}, {}]);
    expect(nums.map((n) => n.display)).toEqual([...Array(39).keys()].map((i) => i + 1));
    expect(nums.every((n) => !n.answered)).toBe(true);
    expect(nums[13]).toMatchObject({ passageIndex: 1, num: 1, display: 14 });
  });

  it('shows labels with the offset, including Choose TWO', () => {
    const q = allQuestions(passages[1]!)[0]!;
    expect(displayLabel(q, 13)).toBe('14');
    expect(displayLabel({ ...q, num: 12, count: 2 }, 13)).toBe('25–26');
    expect(displayLabel({ ...q, num: 12, count: 2 })).toBe('12–13');
  });

  it('renumbers question references in the instructions', () => {
    const text = 'Look at the following researchers (Questions 6–9) and the list below.';
    expect(renumberInstructions(text, 13)).toBe('Look at the following researchers (Questions 19–22) and the list below.');
    expect(renumberInstructions(text, 0)).toBe(text);
  });

  it('marks numbers answered, counting each chosen letter of a Choose TWO question', () => {
    const q = { ...allQuestions(passages[0]!)[0]!, count: 2 };
    expect(isNumberAnswered(q, 'B', 0)).toBe(true);
    expect(isNumberAnswered(q, 'B', 1)).toBe(false);
    expect(isNumberAnswered(q, 'B,D', 1)).toBe(true);
    const single = { ...q, count: undefined };
    expect(isNumberAnswered(single, '  ')).toBe(false);
    expect(isNumberAnswered(single, 'A')).toBe(true);
  });
});

describe('scoring', () => {
  const passages = PASSAGES.slice(0, 3);

  it('adds up the 3 passages and converts the band to 40 questions', () => {
    const all = passages.map(fullAnswers);
    expect(mockScore(passages, all)).toBe(39);
    expect(mockScore(passages, [all[0]!, {}, {}])).toBe(totalMarks(passages[0]!));
    expect(mockBand(39, 39)).toBe(9);
    expect(mockBand(0, 39)).toBeNull();
    expect(mockBand(26, 39)).toBe(6.5); // 26/39 → 40問中27
  });

  it('gives accuracy per question type', () => {
    const all = passages.map(fullAnswers);
    const rows = typeAccuracy(passages, all);
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(39);
    for (const r of rows) expect(r.marks).toBe(r.total);
    const empty = typeAccuracy(passages, [{}, {}, {}]);
    for (const r of empty) expect(r.marks).toBe(0);
  });
});

describe('formatClock', () => {
  it('formats minutes and seconds, with a minus for negative values', () => {
    expect(formatClock(3600)).toBe('60:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(-12)).toBe('-0:12');
  });
});

describe('mock history', () => {
  beforeEach(() => localStorage.clear());

  it('saves results in order and keeps the passage ids', () => {
    expect(loadMockHistory()).toEqual([]);
    saveMockRecord({ score: 20, total: 39, band: 5.5, passageIds: ['r01', 'r02', 'r03'] }, new Date('2026-01-01T00:00:00Z'));
    saveMockRecord({ score: 30, total: 39, band: 7, passageIds: ['r04', 'r05', 'r06'] }, new Date('2026-01-02T00:00:00Z'));
    const history = loadMockHistory();
    expect(history.map((h) => h.score)).toEqual([20, 30]);
    expect(history[1]).toEqual({
      at: '2026-01-02T00:00:00.000Z',
      score: 30,
      total: 39,
      band: 7,
      passageIds: ['r04', 'r05', 'r06'],
    });
    expect(JSON.parse(localStorage.getItem('ielts_reading_mock_v1')!)).toHaveLength(2);
  });

  it('ignores broken data', () => {
    localStorage.setItem('ielts_reading_mock_v1', '{oops');
    expect(loadMockHistory()).toEqual([]);
  });
});
