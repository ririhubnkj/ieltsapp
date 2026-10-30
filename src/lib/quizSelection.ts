import { isWordToken } from './tokenize';
import type { MarkingRange, QuizMode } from '../types';

export function quizCount(n: number, ratio: number): number {
  if (n === 0) return 0;
  return Math.min(n, Math.max(1, Math.round(n * ratio)));
}

export function allWordRanges(tokens: string[]): MarkingRange[] {
  const result: MarkingRange[] = [];
  tokens.forEach((token, i) => {
    if (isWordToken(token)) result.push({ start: i, end: i });
  });
  return result;
}

export function expandToWordRanges(tokens: string[], ranges: MarkingRange[]): MarkingRange[] {
  const indices = new Set<number>();
  for (const r of ranges) {
    for (let i = r.start; i <= r.end; i++) {
      if (i < tokens.length && isWordToken(tokens[i]!)) indices.add(i);
    }
  }
  return [...indices].sort((a, b) => a - b).map((i) => ({ start: i, end: i }));
}

export function quizCandidates(tokens: string[], ranges: MarkingRange[], mode: QuizMode): MarkingRange[] {
  return mode === 'allWords' ? allWordRanges(tokens) : expandToWordRanges(tokens, ranges);
}

export function pickQuizRanges(
  ranges: MarkingRange[],
  ratio: number,
  rng: () => number = Math.random,
): MarkingRange[] {
  const n = ranges.length;
  if (n === 0) return [];

  const k = quizCount(n, ratio);

  const pool = [...ranges];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }

  return pool.slice(0, k).sort((a, b) => a.start - b.start);
}

/** 固定した穴を必ず含めつつ、全体が ratio になるよう残りをランダムに選ぶ */
export function pickBlanks(
  candidates: MarkingRange[],
  pinned: number[],
  ratio: number,
  rng: () => number = Math.random,
): MarkingRange[] {
  const pinnedSet = new Set(pinned);
  const others = candidates.filter((r) => !pinnedSet.has(r.start));
  const total = blankCount(candidates, pinned, ratio);
  const randomPart = shuffle(others, rng).slice(0, Math.max(0, total - pinnedSet.size));
  return [...[...pinnedSet].map((i) => ({ start: i, end: i })), ...randomPart].sort((a, b) => a.start - b.start);
}

export function blankCount(candidates: MarkingRange[], pinned: number[], ratio: number): number {
  const pinnedSet = new Set(pinned);
  const poolSize = candidates.filter((r) => !pinnedSet.has(r.start)).length + pinnedSet.size;
  return Math.max(quizCount(poolSize, ratio), pinnedSet.size);
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool;
}

const AUTO_SKIP_WORDS = new Set([
  // 冠詞
  'a', 'an', 'the',
  // be動詞
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  // 等位接続詞
  'and',
  // 接続副詞
  'accordingly', 'additionally', 'also', 'besides', 'consequently', 'conversely',
  'finally', 'first', 'firstly', 'furthermore', 'hence', 'however', 'indeed',
  'instead', 'lastly', 'likewise', 'meanwhile', 'moreover', 'nevertheless',
  'nonetheless', 'otherwise', 'overall', 'second', 'secondly', 'similarly',
  'still', 'subsequently', 'then', 'therefore', 'third', 'thirdly', 'thus',
  // 頻度の副詞
  'always', 'constantly', 'ever', 'frequently', 'generally', 'never', 'normally',
  'occasionally', 'often', 'rarely', 'regularly', 'seldom', 'sometimes',
  'typically', 'usually',
  // 助動詞
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought',
  "can't", 'cannot', "couldn't", "mightn't", "mustn't", "shan't", "shouldn't",
  "won't", "wouldn't", "'ll", "'d",
  // 前置詞(句動詞の副詞小辞になりやすい up/down/out/off は対象外)
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'as', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between',
  'beyond', 'by', 'despite', 'during', 'except', 'for', 'from', 'in', 'inside',
  'into', 'near', 'of', 'on', 'onto', 'outside', 'over', 'per', 'since',
  'through', 'throughout', 'till', 'to', 'toward', 'towards', 'under',
  'underneath', 'until', 'upon', 'via', 'with', 'within', 'without',
  // 代名詞(人称・所有・再帰・指示・関係)
  'i', 'me', 'my', 'mine', 'myself', 'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves',
  'oneself', 'this', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what',
  "i'm", "i've", "i'll", "i'd", "you're", "you've", "you'll", "you'd", "he's", "he'll", "he'd",
  "she's", "she'll", "she'd", "it's", "it'll", "we're", "we've", "we'll", "we'd",
  "they're", "they've", "they'll", "they'd", "that's", "what's", "who's",
  // 接続詞(and 以外。for/as/since/until/before/after は前置詞に含めた)
  'but', 'or', 'nor', 'so', 'yet', 'because', 'although', 'though', 'while', 'whereas',
  'if', 'unless', 'when', 'whenever', 'where', 'wherever', 'whether', 'that', 'than',
  'both', 'either', 'neither',
]);

/** 自分専用版のエッセイの型。どの題材にも出てくるので穴にしない */
const TEMPLATE_PHRASES = [
  'some might claim that',
  'a good example of this can be observed in japan',
  'additionally',
  'therefore',
  'however others assert that',
  'however opponents',
  'firstly',
  'for instance',
  'secondly',
  'as can be seen in',
  // Task 2 の賛成反対・メリットデメリットの型
  'admittedly some people argue that',
  'however i firmly believe that',
  'one major advantage of',
  'on the other hand there are some serious drawbacks to',
  // Task 1 の型
  'overall it is clear that',
  'looking first at',
  'turning to',
  'meanwhile',
  // TOEFL の Email の型
  'dear',
  'hello i hope you are doing well',
  'i am writing to',
  'i am writing about',
  'i am writing regarding',
  'i would appreciate it if you could',
  'if possible could you',
  'thank you for your time and consideration',
  'thank you for your consideration',
  'best regards',
  'misaki',
].map((p) => p.split(' '));

/** 本文中の、エッセイの型にあたる語のインデックス(句読点は飛ばして照合する) */
export function templateTokenIndices(tokens: string[]): number[] {
  const words = tokens
    .map((t, i) => ({ w: t.toLowerCase(), i }))
    .filter(({ w }) => isWordToken(w));
  const result: number[] = [];
  for (let k = 0; k < words.length; k++) {
    for (const phrase of TEMPLATE_PHRASES) {
      if (phrase.every((p, j) => words[k + j]?.w === p)) {
        for (let j = 0; j < phrase.length; j++) result.push(words[k + j]!.i);
      }
    }
  }
  return result;
}

/** 本文中の数値(8.3・2020・12,539 など)のインデックス。Task 1 の数字は覚える対象ではないので穴にしない */
export function numberTokenIndices(tokens: string[]): number[] {
  return tokens.flatMap((t, i) => (/\d/.test(t) ? [i] : []));
}

/** 自動の穴埋めでは避ける語(冠詞・be動詞・助動詞・前置詞・代名詞・接続詞・接続副詞・頻度の副詞) */
export function isAutoSkipWord(token: string): boolean {
  // カーリーアポストロフィ(’)も同じ語として扱う
  return AUTO_SKIP_WORDS.has(token.toLowerCase().replace(/’/g, "'"));
}

export interface BlankOptions {
  /** 必ず穴にするトークン */
  pinned?: number[];
  /** 穴にしないトークン */
  excluded?: number[];
  /** エッセイの型(Some might claim that など)と数値を穴にしない */
  skipTemplates?: boolean;
}

/**
 * 出題候補を作る。
 * - 除外した語はどの割合でも候補に入れない。
 * - 「全単語からランダム」で割合が100%未満のときは、冠詞・be動詞・and・
 *   接続副詞・頻度の副詞も候補に入れない。マーキングした語には適用しない。
 * - 手動で固定した語はどちらの場合も候補に残す。
 */
export function blankCandidates(
  tokens: string[],
  ranges: MarkingRange[],
  mode: QuizMode,
  ratio: number,
  options: BlankOptions = {},
): MarkingRange[] {
  const pinnedSet = new Set(options.pinned ?? []);
  const excludedSet = new Set([
    ...(options.excluded ?? []),
    ...(options.skipTemplates ? [...templateTokenIndices(tokens), ...numberTokenIndices(tokens)] : []),
  ]);
  const skipFunctionWords = ratio < 1 && mode === 'allWords';

  return quizCandidates(tokens, ranges, mode).filter((r) => {
    if (pinnedSet.has(r.start)) return true;
    if (r.start === r.end && excludedSet.has(r.start)) return false;
    if (!skipFunctionWords) return true;
    return r.start !== r.end || !isAutoSkipWord(tokens[r.start] ?? '');
  });
}
