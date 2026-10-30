/**
 * IELTS Reading の演習(本文・設問・解説は src/data/reading/*.json)。
 * 結果はこの端末に保存する(英文のデータとは別に持つ)
 */
import { levelOfPassageId, type LevelId } from './levels';

export type QuestionType =
  | 'paragraph'
  | 'tfng'
  | 'ynng'
  | 'mcq'
  | 'mcq2'
  | 'matching'
  | 'headings'
  | 'endings'
  | 'wordlist'
  | 'completion'
  | 'short';

export interface Choice {
  key: string;
  text: string;
}

export interface ReadingQuestion {
  num: number;
  /** 配点(Choose TWO の mcq2 は2問分。番号も2つ使う) */
  count?: number;
  text: string;
  /** 選択肢(mcq は A〜D、mcq2 は A〜E) */
  choices?: Choice[];
  /** 正解(completion・short 以外)。mcq2 は2つの記号をカンマでつないだもの(B,D) */
  answer?: string;
  /** 正解として認める語句(completion・short だけ。小文字) */
  accept?: string[];
  /** 根拠のある段落 */
  evidence: string;
  explanation: string;
}

export interface QuestionGroup {
  type: QuestionType;
  instructions: string;
  /** 選択肢の一覧(matching・headings・endings・wordlist) */
  options?: Choice[];
  questions: ReadingQuestion[];
}

export interface ReadingPassage {
  id: string;
  title: string;
  titleJa: string;
  minutes: number;
  paragraphs: { label: string; text: string }[];
  groups: QuestionGroup[];
  vocab: { en: string; ja: string }[];
}

const files = import.meta.glob<ReadingPassage>(['../data/reading/*.json', '../data/levels/*/reading/*.json'], {
  import: 'default',
  eager: true,
});

/** 演習の一覧(レベル別のファイルが先、その中はファイル名の順) */
export const PASSAGES: ReadingPassage[] = Object.keys(files)
  .sort()
  .map((k) => files[k]!);

/** あるレベルの演習 */
export function passagesForLevel(level: LevelId): ReadingPassage[] {
  return PASSAGES.filter((p) => levelOfPassageId(p.id) === level);
}

export function getPassage(id: string | undefined): ReadingPassage | null {
  return PASSAGES.find((p) => p.id === id) ?? null;
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  paragraph: '段落選択',
  tfng: 'TRUE / FALSE / NOT GIVEN',
  ynng: 'YES / NO / NOT GIVEN',
  mcq: '4択',
  mcq2: '2つ選ぶ',
  matching: '組み合わせ',
  headings: '見出し選択',
  endings: '文の後半選択',
  wordlist: '語群から要約完成',
  completion: '空所補充',
  short: '短答',
};

/** 自分で書いて答える設問 */
export function isWritten(type: QuestionType): boolean {
  return type === 'completion' || type === 'short';
}

/** ボタンで選ぶ設問の選択肢(completion は自分で書くので空) */
export function answerOptions(passage: ReadingPassage, group: QuestionGroup, question: ReadingQuestion): string[] {
  switch (group.type) {
    case 'tfng':
      return ['TRUE', 'FALSE', 'NOT GIVEN'];
    case 'ynng':
      return ['YES', 'NO', 'NOT GIVEN'];
    case 'paragraph':
      return passage.paragraphs.map((p) => p.label);
    case 'matching':
    case 'headings':
    case 'endings':
    case 'wordlist':
      return (group.options ?? []).map((o) => o.key);
    case 'mcq':
    case 'mcq2':
      return (question.choices ?? []).map((c) => c.key);
    case 'completion':
    case 'short':
      return [];
  }
}

/** 書いた答えを比べやすい形にする(大文字小文字・前後の空白・句読点・冠詞の違いは問わない) */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' -]/g, ' ')
    .replace(/^\s*(the|a|an)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** mcq2 の答え(B,D)を記号の一覧にする */
export function splitKeys(value: string | undefined): string[] {
  return (value ?? '').split(',').filter(Boolean);
}

/** 1問の得点。mcq2 は選んだ記号のうち正しいものの数(2つまで) */
export function marksFor(question: ReadingQuestion, given: string | undefined): number {
  if (!given) return 0;
  if (question.accept) {
    const g = normalizeAnswer(given);
    return question.accept.some((a) => normalizeAnswer(a) === g) ? 1 : 0;
  }
  if ((question.count ?? 1) > 1) {
    const correct = splitKeys(question.answer);
    return splitKeys(given)
      .slice(0, correct.length)
      .filter((k) => correct.includes(k)).length;
  }
  return given === question.answer ? 1 : 0;
}

/** 満点だったか(mcq2 は2つとも正しいときだけ) */
export function isCorrect(question: ReadingQuestion, given: string | undefined): boolean {
  return marksFor(question, given) === (question.count ?? 1);
}

/** 設問の番号の表示(mcq2 は 12–13 のように2つ) */
export function questionLabel(question: ReadingQuestion): string {
  const count = question.count ?? 1;
  return count > 1 ? `${question.num}–${question.num + count - 1}` : String(question.num);
}

/** 満点(mcq2 は2点として数える) */
export function totalMarks(passage: ReadingPassage): number {
  return allQuestions(passage).reduce((sum, q) => sum + (q.count ?? 1), 0);
}

/** 正解として見せる文字列 */
export function correctAnswerLabel(question: ReadingQuestion): string {
  return question.accept ? question.accept.join(' / ') : splitKeys(question.answer).join(' と ');
}

export function allQuestions(passage: ReadingPassage): ReadingQuestion[] {
  return passage.groups.flatMap((g) => g.questions);
}

export function score(passage: ReadingPassage, answers: Record<number, string>): number {
  return allQuestions(passage).reduce((sum, q) => sum + marksFor(q, answers[q.num]), 0);
}

/**
 * Academic Reading の正答数(40問)とバンドの目安。演習は13問前後なので40問に換算して当てはめる
 */
const BAND_TABLE: [number, number][] = [
  [39, 9],
  [37, 8.5],
  [35, 8],
  [33, 7.5],
  [30, 7],
  [27, 6.5],
  [23, 6],
  [19, 5.5],
  [15, 5],
  [13, 4.5],
  [10, 4],
  [8, 3.5],
  [6, 3],
  [4, 2.5],
];

export function estimatedBand(correct: number, total: number): number | null {
  if (total === 0) return null;
  const outOf40 = Math.round((correct / total) * 40);
  return BAND_TABLE.find(([min]) => outOf40 >= min)?.[1] ?? null;
}

export interface ReadingResult {
  best: number;
  last: number;
  total: number;
  attempts: number;
  at: string;
}

const RESULTS_KEY = 'ielts_reading_results';

export function loadResults(): Record<string, ReadingResult> {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ReadingResult>) : {};
  } catch {
    return {};
  }
}

export function saveResult(passageId: string, correct: number, total: number, now = new Date()): ReadingResult {
  const results = loadResults();
  const prev = results[passageId];
  const next: ReadingResult = {
    best: Math.max(prev?.best ?? 0, correct),
    last: correct,
    total,
    attempts: (prev?.attempts ?? 0) + 1,
    at: now.toISOString(),
  };
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify({ ...results, [passageId]: next }));
  } catch {
    // 保存できない環境では結果を残さない
  }
  return next;
}
