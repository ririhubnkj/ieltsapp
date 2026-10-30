import { isWordToken, tokenize } from './tokenize';
import type { Entry, MarkingRange, MarkingSet } from '../types';

export interface PresetTopic {
  /** 追加済みかどうかの判定に使う固定ID */
  presetId: string;
  title: string;
  /** 本文。{{ }} で囲んだ部分は追加時にマーキング済みになる */
  text: string;
}

/** IELTS Task 1 の題材の presetId の接頭辞 */
export const TASK1_PREFIX = 'task1-';

/** TOEFL Writing(Email)の題材の presetId の接頭辞 */
export const TOEFL_PREFIX = 'toefl-';

/** チャンク大全(イディオム700・句動詞300を組み合わせた例文。1日分ずつ)の presetId の接頭辞 */
export const CHUNK_PREFIX = 'chunk-';

/** Idiomatic 300(1日10文)の presetId の接頭辞 */
export const IDIOMATIC_PREFIX = 'idiomatic300-';

const HEADING_RE = /^\*\*(\d+)\.\s*(.+?)\*\*\s*$/;

/** 「**番号. タイトル**」の見出しと本文が並んだテキストを題材の一覧にする */
export function parsePresetTopics(raw: string, idPrefix = 'topic-'): PresetTopic[] {
  const topics: PresetTopic[] = [];
  let current: { num: string; title: string; lines: string[] } | null = null;
  const flush = () => {
    if (!current) return;
    const text = current.lines.join('\n').trim();
    if (text) topics.push({ presetId: `${idPrefix}${current.num}`, title: `${current.num}. ${current.title}`, text });
  };
  for (const line of raw.split(/\r?\n/)) {
    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      current = { num: heading[1]!, title: heading[2]!.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return topics;
}

/**
 * {{ }} の印を外してトークン化し、印の付いた語をマーキング範囲にする。
 * {{+ }} は直前の表現の続き(give them an edge in の an edge in など)で、同じ表現として数える。
 */
export function parseMarkedText(text: string): {
  tokens: string[];
  ranges: MarkingRange[];
  /** 表現ごとの、印の付いた語のトークンインデックス */
  expressions: number[][];
} {
  const tokens: string[] = [];
  const ranges: MarkingRange[] = [];
  const expressions: number[][] = [];
  text.split(/(\{\{.*?\}\})/s).forEach((part) => {
    const marked = part.startsWith('{{') && part.endsWith('}}');
    let body = marked ? part.slice(2, -2) : part;
    if (marked) {
      const continues = body.startsWith('+') && expressions.length > 0;
      body = body.replace(/^\+/, '');
      if (!continues) expressions.push([]);
    }
    for (const token of tokenize(body)) {
      if (marked && isWordToken(token)) {
        ranges.push({ start: tokens.length, end: tokens.length });
        expressions[expressions.length - 1]!.push(tokens.length);
      }
      tokens.push(token);
    }
  });
  return { tokens, ranges, expressions };
}

/**
 * 本文の改行位置。キーは行の最後のトークンのインデックスで、値は段落の切れ目(空行)なら true、
 * ただの改行(メールの「Best regards,」の後など)なら false。最後の行は含めない。
 */
export function lineBreaks(text: string): Map<number, boolean> {
  const breaks = new Map<number, boolean>();
  let count = 0;
  let last: number | null = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      if (last !== null) breaks.set(last, true);
      continue;
    }
    count += parseMarkedText(line).tokens.length;
    last = count - 1;
    breaks.set(last, false);
  }
  if (last !== null) breaks.delete(last);
  return breaks;
}

/** まだ追加していない題材だけを、登録用のEntryとマーキングにする */
export function presetEntriesToAdd(
  topics: PresetTopic[],
  existing: Entry[],
  now = new Date(),
  deckId?: string,
): { entries: Entry[]; markings: MarkingSet[] } {
  const added = new Set(existing.map((e) => e.presetId).filter(Boolean));
  const entries: Entry[] = [];
  const markings: MarkingSet[] = [];
  topics
    .filter((t) => !added.has(t.presetId))
    .forEach((t, i) => {
      const { tokens, ranges } = parseMarkedText(t.text);
      const id = crypto.randomUUID();
      entries.push({
        id,
        // 登録順を保つため1ミリ秒ずつずらす
        createdAt: new Date(now.getTime() + i).toISOString(),
        tokens,
        title: t.title,
        presetId: t.presetId,
        deckId,
      });
      markings.push({ entryId: id, ranges });
    });
  return { entries, markings };
}

/**
 * 内蔵題材の本文を書き換えたとき、追加済みの英文を新しい本文に差し替える。
 * トークンの位置が変わるので、固定・除外・和訳の修正は消し、マーキングも題材の {{ }} に戻す
 */
export function presetEntriesToRefresh(
  topics: PresetTopic[],
  existing: Entry[],
): { entries: Entry[]; markings: MarkingSet[] } {
  const entries: Entry[] = [];
  const markings: MarkingSet[] = [];
  for (const e of existing) {
    // 自分で本文を書き換えた英文は、そちらを優先して差し替えない
    if (e.edited) continue;
    const topic = e.presetId ? topics.find((t) => t.presetId === e.presetId) : undefined;
    if (!topic) continue;
    const { tokens, ranges } = parseMarkedText(topic.text);
    if (tokens.length === e.tokens.length && tokens.every((t, i) => t === e.tokens[i])) continue;
    entries.push({ ...e, tokens, pinned: undefined, excluded: undefined, glosses: undefined });
    markings.push({ entryId: e.id, ranges });
  }
  return { entries, markings };
}
