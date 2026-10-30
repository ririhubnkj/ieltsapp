/**
 * 苦手の復習(間隔反復)。穴埋めで固定した語(間違えた・覚えたい語)を、日をあけて出し直す。
 * 覚えていたら次に出す日を延ばし、忘れていたら翌日に戻す。最後の段階で覚えていたら卒業
 */
import { isWordToken } from './tokenize';
import { sentenceIndices } from './translation';

export interface ReviewItem {
  /** entryId:tokenIndex */
  id: string;
  entryId: string;
  index: number;
  /** 追加したときの語(本文を書き換えて位置がずれたら出さない) */
  word: string;
  /** 0〜(INTERVALS.length - 1) */
  box: number;
  /** 次に出す日時 */
  due: string;
  added: string;
}

/** 段階ごとの、次に出すまでの日数 */
export const INTERVALS = [1, 2, 4, 7, 15, 30];

const KEY = 'ielts_review_v1';

export function loadReview(): ReviewItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReviewItem[]) : [];
  } catch {
    return [];
  }
}

function saveReview(items: ReviewItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // 保存できない環境では復習を残さない
  }
}

function addDays(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  // その日のうちならいつでも出せるよう、日付の始まりにそろえる
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** 復習に入れる(すでに入っていれば何もしない)。追加した日のうちにも1回出す */
export function addReviewItem(entryId: string, index: number, word: string, now = new Date()): void {
  const items = loadReview();
  const id = `${entryId}:${index}`;
  if (items.some((i) => i.id === id)) return;
  saveReview([...items, { id, entryId, index, word, box: 0, due: now.toISOString(), added: now.toISOString() }]);
}

export function removeReviewItem(id: string): void {
  saveReview(loadReview().filter((i) => i.id !== id));
}

export function isInReview(entryId: string, index: number): boolean {
  return loadReview().some((i) => i.id === `${entryId}:${index}`);
}

/** 今日出す語(期限が来たもの。古い順) */
export function dueItems(items: ReviewItem[], now = new Date()): ReviewItem[] {
  return items.filter((i) => new Date(i.due) <= now).sort((a, b) => a.due.localeCompare(b.due));
}

/** 答え合わせの結果を反映する。卒業したら一覧から外す */
export function gradeReviewItem(id: string, remembered: boolean, now = new Date()): void {
  const items = loadReview();
  const item = items.find((i) => i.id === id);
  if (!item) return;
  if (remembered && item.box >= INTERVALS.length - 1) {
    saveReview(items.filter((i) => i.id !== id));
    return;
  }
  const box = remembered ? item.box + 1 : 0;
  const next = { ...item, box, due: addDays(now, INTERVALS[remembered ? box : 0]!) };
  saveReview(items.map((i) => (i.id === id ? next : i)));
}

/** 出題する語を含む1文(トークンの範囲)と、その文が本文の何文目か */
export function sentenceAround(tokens: string[], index: number): { start: number; end: number; sentence: number } {
  const of = sentenceIndices(tokens);
  const s = of[index] ?? 0;
  const start = of.indexOf(s);
  const end = of.lastIndexOf(s);
  return { start, end, sentence: s };
}

/** 本文が変わって、保存した位置の語が別の語になっていないか */
export function stillMatches(item: ReviewItem, tokens: string[]): boolean {
  const t = tokens[item.index];
  return !!t && isWordToken(t) && t === item.word;
}
