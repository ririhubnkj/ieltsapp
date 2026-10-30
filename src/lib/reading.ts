/**
 * IELTS Reading の演習(本文・設問・解説は src/data/reading/*.json)。
 * 結果はこの端末に保存する(英文のデータとは別に持つ)
 */

export type QuestionType = 'paragraph' | 'tfng' | 'ynng' | 'mcq' | 'matching' | 'completion';

export interface Choice {
  key: string;
  text: string;
}

export interface ReadingQuestion {
  num: number;
  text: string;
  /** 4択の選択肢(mcq だけ) */
  choices?: Choice[];
  /** 正解(completion 以外) */
  answer?: string;
  /** 正解として認める語句(completion だけ。小文字) */
  accept?: string[];
  /** 根拠のある段落 */
  evidence: string;
  explanation: string;
}

export interface QuestionGroup {
  type: QuestionType;
  instructions: string;
  /** 組み合わせ問題の選択肢(matching だけ) */
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

const files = import.meta.glob<ReadingPassage>('../data/reading/*.json', { import: 'default', eager: true });

/** 演習の一覧(ファイル名の順) */
export const PASSAGES: ReadingPassage[] = Object.keys(files)
  .sort()
  .map((k) => files[k]!);

export function getPassage(id: string | undefined): ReadingPassage | null {
  return PASSAGES.find((p) => p.id === id) ?? null;
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  paragraph: '段落選択',
  tfng: 'TRUE / FALSE / NOT GIVEN',
  ynng: 'YES / NO / NOT GIVEN',
  mcq: '4択',
  matching: '組み合わせ',
  completion: '空所補充',
};

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
      return (group.options ?? []).map((o) => o.key);
    case 'mcq':
      return (question.choices ?? []).map((c) => c.key);
    case 'completion':
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

export function isCorrect(question: ReadingQuestion, given: string | undefined): boolean {
  if (!given) return false;
  if (question.accept) {
    const g = normalizeAnswer(given);
    return question.accept.some((a) => normalizeAnswer(a) === g);
  }
  return given === question.answer;
}

/** 正解として見せる文字列 */
export function correctAnswerLabel(question: ReadingQuestion): string {
  return question.accept ? question.accept.join(' / ') : (question.answer ?? '');
}

export function allQuestions(passage: ReadingPassage): ReadingQuestion[] {
  return passage.groups.flatMap((g) => g.questions);
}

export function score(passage: ReadingPassage, answers: Record<number, string>): number {
  return allQuestions(passage).filter((q) => isCorrect(q, answers[q.num])).length;
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
