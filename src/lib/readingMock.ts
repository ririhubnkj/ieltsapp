/**
 * Reading の模試(3題・60分)。題の選び方、通し番号、採点の集計、結果の履歴
 */
import { LEVELS, levelOfPassageId, type LevelId } from './levels';
import {
  allQuestions,
  estimatedBand,
  marksFor,
  PASSAGES,
  score,
  splitKeys,
  totalMarks,
  TYPE_LABEL,
  type QuestionType,
  type ReadingPassage,
  type ReadingQuestion,
} from './reading';

/** 模試で解く題の数と制限時間 */
export const MOCK_PASSAGES = 3;
export const MOCK_MINUTES = 60;

function levelIndex(id: LevelId): number {
  return LEVELS.findIndex((l) => l.id === id);
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** やさしいレベルの題を先に並べる(本番も後の Passage ほど難しい) */
export function sortByLevel(passages: ReadingPassage[]): ReadingPassage[] {
  return passages
    .map((p, i) => ({ p, i }))
    .sort((a, b) => levelIndex(levelOfPassageId(a.p.id)) - levelIndex(levelOfPassageId(b.p.id)) || a.i - b.i)
    .map((x) => x.p);
}

/**
 * 模試の3題を選ぶ。選んだレベルから無作為に選び、足りなければ近いレベル(1つ上下、2つ上下…)から足す
 */
export function pickMockPassages(
  level: LevelId,
  rand: () => number = Math.random,
  pool: ReadingPassage[] = PASSAGES,
): ReadingPassage[] {
  const base = levelIndex(level);
  const picked: ReadingPassage[] = [];
  for (let distance = 0; distance < LEVELS.length && picked.length < MOCK_PASSAGES; distance++) {
    const candidates = pool.filter((p) => Math.abs(levelIndex(levelOfPassageId(p.id)) - base) === distance);
    picked.push(...shuffle(candidates, rand).slice(0, MOCK_PASSAGES - picked.length));
  }
  return sortByLevel(picked);
}

/** 各題の番号に足す数(2題目は1題目の配点の分だけずらす) */
export function questionOffsets(passages: ReadingPassage[]): number[] {
  let next = 0;
  return passages.map((p) => {
    const offset = next;
    next += totalMarks(p);
    return offset;
  });
}

/** 模試の満点 */
export function mockTotalMarks(passages: ReadingPassage[]): number {
  return passages.reduce((sum, p) => sum + totalMarks(p), 0);
}

/** 模試の得点(answers は題ごとの答え) */
export function mockScore(passages: ReadingPassage[], answers: Record<number, string>[]): number {
  return passages.reduce((sum, p, i) => sum + score(p, answers[i] ?? {}), 0);
}

/** 模試のバンドの目安(40問に換算) */
export function mockBand(correct: number, total: number): number | null {
  return estimatedBand(correct, total);
}

/** 通し番号での設問の番号の表示(mcq2 は 25–26 のように2つ) */
export function displayLabel(question: ReadingQuestion, offset = 0): string {
  const first = question.num + offset;
  const count = question.count ?? 1;
  return count > 1 ? `${first}–${first + count - 1}` : String(first);
}

/** 指示文の中の「Questions 1–4」を通し番号に直す */
export function renumberInstructions(text: string, offset = 0): string {
  if (offset === 0) return text;
  return text.replace(
    /(Questions?\s+)(\d+)(\s*[–-]\s*)(\d+)/g,
    (_, word: string, a: string, dash: string, b: string) => `${word}${Number(a) + offset}${dash}${Number(b) + offset}`,
  );
}

/** 番号1つ分が答えてあるか(mcq2 は選んだ記号の数だけ、前の番号から答えたことにする) */
export function isNumberAnswered(question: ReadingQuestion, value: string | undefined, part = 0): boolean {
  if ((question.count ?? 1) > 1) return splitKeys(value).length > part;
  return !!value?.trim();
}

export interface MockNumber {
  /** 何題目か(0から) */
  passageIndex: number;
  /** その題の中での設問の番号(画面の要素を探すのに使う) */
  num: number;
  /** 通し番号 */
  display: number;
  answered: boolean;
}

/** 解答状況の一覧(通し番号1〜39) */
export function mockNumbers(passages: ReadingPassage[], answers: Record<number, string>[]): MockNumber[] {
  const offsets = questionOffsets(passages);
  return passages.flatMap((p, pi) =>
    allQuestions(p).flatMap((q) =>
      [...Array(q.count ?? 1).keys()].map((part) => ({
        passageIndex: pi,
        num: q.num,
        display: q.num + part + offsets[pi]!,
        answered: isNumberAnswered(q, answers[pi]?.[q.num], part),
      })),
    ),
  );
}

export interface TypeAccuracy {
  type: QuestionType;
  marks: number;
  total: number;
}

/** 設問の形式ごとの得点(TYPE_LABEL の順) */
export function typeAccuracy(passages: ReadingPassage[], answers: Record<number, string>[]): TypeAccuracy[] {
  const byType = new Map<QuestionType, TypeAccuracy>();
  passages.forEach((p, pi) => {
    for (const g of p.groups) {
      const row = byType.get(g.type) ?? { type: g.type, marks: 0, total: 0 };
      for (const q of g.questions) {
        row.marks += marksFor(q, answers[pi]?.[q.num]);
        row.total += q.count ?? 1;
      }
      byType.set(g.type, row);
    }
  });
  const order = Object.keys(TYPE_LABEL) as QuestionType[];
  return [...byType.values()].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

/** 秒を 12:05 の形にする(負の数は -0:12) */
export function formatClock(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(seconds));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

export interface MockRecord {
  at: string;
  score: number;
  total: number;
  band: number | null;
  passageIds: string[];
}

const HISTORY_KEY = 'ielts_reading_mock_v1';
/** 残す履歴の上限 */
const HISTORY_MAX = 50;

/** 模試の結果の履歴(古い順) */
export function loadMockHistory(): MockRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as MockRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveMockRecord(record: Omit<MockRecord, 'at'>, now = new Date()): MockRecord[] {
  const next = [...loadMockHistory(), { ...record, at: now.toISOString() }].slice(-HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // 保存できない環境では履歴を残さない
  }
  return next;
}
