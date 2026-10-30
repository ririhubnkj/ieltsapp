import raw from '../data/presetTopics.txt?raw';
import translationsRaw from '../data/presetTranslations.txt?raw';
import task1Raw from '../data/task1Topics.txt?raw';
import task1TranslationsRaw from '../data/task1Translations.txt?raw';
import toeflRaw from '../data/toeflTopics.txt?raw';
import toeflTranslationsRaw from '../data/toeflTranslations.txt?raw';
import toeflPromptsRaw from '../data/toeflPrompts.txt?raw';
import toeflDiscussionsRaw from '../data/toeflDiscussions.txt?raw';
import task2PromptsRaw from '../data/task2Prompts.txt?raw';
import band6Task2Raw from '../data/band6/task2Topics.txt?raw';
import band6Task2TranslationsRaw from '../data/band6/task2Translations.txt?raw';
import band6Task1Raw from '../data/band6/task1Topics.txt?raw';
import band6Task1TranslationsRaw from '../data/band6/task1Translations.txt?raw';
import chunkRaw from '../data/chunkTopics.txt?raw';
import chunkTranslationsRaw from '../data/chunkTranslations.txt?raw';
import idiomaticRaw from '../data/idiomatic300Topics.txt?raw';
import task2ModelRaw from '../data/band6/task2Models.txt?raw';
import task2ModelTranslationsRaw from '../data/band6/task2ModelTranslations.txt?raw';
import task2ModelPromptsRaw from '../data/band6/task2ModelPrompts.txt?raw';
import collocationRaw from '../data/collocationTopics.txt?raw';
import collocationTranslationsRaw from '../data/collocationTranslations.txt?raw';
import speakingRaw from '../data/speakingTopics.txt?raw';
import speakingTranslationsRaw from '../data/speakingTranslations.txt?raw';
import speakingPromptsRaw from '../data/speakingPrompts.txt?raw';
import {
  CHUNK_PREFIX,
  COLLOCATION_PREFIX,
  IDIOMATIC_PREFIX,
  lineBreaks,
  parseMarkedText,
  parsePresetTopics,
  SPEAKING_PREFIX,
  TASK1_PREFIX,
  TASK2_MODEL_PREFIX,
  TOEFL_PREFIX,
  type PresetTopic,
} from './presets';
import type { Entry, MarkingRange } from '../types';
import { parseTranslations } from './translation';
import { svgDataUrl } from './figureImage';
import { HAS_PRESETS } from './target';

// みんな向けの IELTS 版は、同じ型のまま、バンド6.0〜6.5の書き方にしたモデルアンサーを使う。
// Task 1 は数値・地名などを元の問題から変えたオリジナルの図にする
// (VITE_TARGET を直接比べ、使わない側の本文と図がバンドルに入らないようにする)
const BAND6 = import.meta.env.VITE_TARGET === 'everyone';

const task1Figures = BAND6
  ? import.meta.glob<string>('../data/band6/task1Figures/*.svg', { query: '?raw', import: 'default', eager: true })
  : import.meta.glob<string>('../data/task1Figures/*.svg', { query: '?raw', import: 'default', eager: true });
const TASK1_FIGURE_DIR = BAND6 ? '../data/band6/task1Figures' : '../data/task1Figures';

let topics: PresetTopic[] | null = null;
let translations: Map<string, string[]> | null = null;
let task1Topics: PresetTopic[] | null = null;
let task1Translations: Map<string, string[]> | null = null;
let toeflTopics: PresetTopic[] | null = null;
let toeflTranslations: Map<string, string[]> | null = null;
let toeflPrompts: Map<string, TaskPrompt> | null = null;
let toeflDiscussions: Map<string, TaskPrompt> | null = null;
let task2Prompts: Map<string, TaskPrompt> | null = null;
let chunkTopics: PresetTopic[] | null = null;
let chunkTranslations: Map<string, string[]> | null = null;
let idiomaticTopics: PresetTopic[] | null = null;
let task2ModelTopics: PresetTopic[] | null = null;
let levelTopicCache: Map<string, PresetTopic[]> | null = null;
let levelTranslationCache: Map<string, string[]> | null = null;
let levelTask2Prompts: Map<string, TaskPrompt> | null = null;
let allTranslationCache: Map<string, string[]> | null = null;
let task2ModelPrompts: Map<string, TaskPrompt> | null = null;
let collocationTopics: PresetTopic[] | null = null;
let speakingTopics: PresetTopic[] | null = null;
let speakingPrompts: Map<string, TaskPrompt> | null = null;

/** 個人版だけで使う内蔵の題材(公開版のバンドルに入らないよう、呼ばれたときに読む) */
export function getPresetTopics(): PresetTopic[] {
  topics ??= parsePresetTopics(BAND6 ? band6Task2Raw : raw);
  return topics;
}

/** 内蔵の題材の全文和訳(キーは presetId) */
export function getPresetTranslations(): Map<string, string[]> {
  translations ??= parseTranslations(BAND6 ? band6Task2TranslationsRaw : translationsRaw);
  return translations;
}

/** IELTS Task 1 のモデルアンサー(図と一緒に出す) */
export function getTask1Topics(): PresetTopic[] {
  task1Topics ??= parsePresetTopics(BAND6 ? band6Task1Raw : task1Raw, TASK1_PREFIX);
  return task1Topics;
}

export function getTask1Translations(): Map<string, string[]> {
  task1Translations ??= parseTranslations(BAND6 ? band6Task1TranslationsRaw : task1TranslationsRaw, TASK1_PREFIX);
  return task1Translations;
}

/** TOEFL Writing の Email のモデルアンサー(問題文と一緒に出す)。みんな向けの IELTS 版には入れない */
export function getToeflTopics(): PresetTopic[] {
  toeflTopics ??= BAND6 ? [] : parsePresetTopics(toeflRaw, TOEFL_PREFIX);
  return toeflTopics;
}

export function getToeflTranslations(): Map<string, string[]> {
  toeflTranslations ??= BAND6 ? new Map() : parseTranslations(toeflTranslationsRaw, TOEFL_PREFIX);
  return toeflTranslations;
}

/** チャンク大全の1日分(17ブロック。21日で1周)。みんな向けの IELTS 版には入れない */
export function getChunkTopics(): PresetTopic[] {
  chunkTopics ??= BAND6 ? [] : parsePresetTopics(chunkRaw, CHUNK_PREFIX);
  return chunkTopics;
}

export function getChunkTranslations(): Map<string, string[]> {
  chunkTranslations ??= BAND6 ? new Map() : parseTranslations(chunkTranslationsRaw, CHUNK_PREFIX);
  return chunkTranslations;
}

/** Idiomatic 300 の1日分(10文。全30日)。和訳は無い。みんな向けの IELTS 版には入れない */
export function getIdiomaticTopics(): PresetTopic[] {
  idiomaticTopics ??= BAND6 ? [] : parsePresetTopics(idiomaticRaw, IDIOMATIC_PREFIX);
  return idiomaticTopics;
}

/** Task 2 の型ごとの全文モデルエッセイ(task2.pdf のエッセイ例)。みんな向けの IELTS 版だけ */
export function getTask2ModelTopics(): PresetTopic[] {
  task2ModelTopics ??= BAND6 ? parsePresetTopics(task2ModelRaw, TASK2_MODEL_PREFIX) : [];
  return task2ModelTopics;
}

/** IELTS の語彙・コロケーション(1トピック10文)。みんな向けの IELTS 版だけ */
export function getCollocationTopics(): PresetTopic[] {
  collocationTopics ??= BAND6 ? parsePresetTopics(collocationRaw, COLLOCATION_PREFIX) : [];
  return collocationTopics;
}

/** IELTS Speaking の Part 1〜3 のモデルアンサー(質問と一緒に出す)。みんな向けの IELTS 版だけ */
export function getSpeakingTopics(): PresetTopic[] {
  speakingTopics ??= BAND6 ? parsePresetTopics(speakingRaw, SPEAKING_PREFIX) : [];
  return speakingTopics;
}

/**
 * レベル別の題材(src/data/levels/<level>/*.txt)。presetId は種類の接頭辞のあとにレベルを入れる
 * (task2model-l1-3・task1-l4-5・colloc-l2-1・speaking-l5-9)。みんな向けの IELTS 版だけ
 */
const levelRaw = BAND6
  ? import.meta.glob<string>('../data/levels/*/*.txt', { query: '?raw', import: 'default', eager: true })
  : {};

/** レベル別の題材のファイル名 → 接頭辞と和訳のファイル名 */
const LEVEL_FILES: { name: string; prefix: string; translations: string }[] = [
  { name: 'task2Models', prefix: TASK2_MODEL_PREFIX, translations: 'task2ModelTranslations' },
  { name: 'task1Topics', prefix: TASK1_PREFIX, translations: 'task1Translations' },
  { name: 'collocationTopics', prefix: COLLOCATION_PREFIX, translations: 'collocationTranslations' },
  { name: 'speakingTopics', prefix: SPEAKING_PREFIX, translations: 'speakingTranslations' },
];

function levelFile(level: string, name: string): string | undefined {
  return levelRaw[`../data/levels/${level}/${name}.txt`];
}

function loadLevelContent() {
  if (levelTopicCache) return;
  levelTopicCache = new Map();
  levelTranslationCache = new Map();
  levelTask2Prompts = new Map();
  const levels = new Set(Object.keys(levelRaw).map((k) => k.split('/')[3]!));
  for (const level of levels) {
    for (const f of LEVEL_FILES) {
      const text = levelFile(level, f.name);
      if (!text) continue;
      const prefix = `${f.prefix}${level}-`;
      levelTopicCache.set(`${level}/${f.name}`, parsePresetTopics(text, prefix));
      const tr = levelFile(level, f.translations);
      if (tr) for (const [k, v] of parseTranslations(tr, prefix)) levelTranslationCache.set(k, v);
    }
    const prompts = levelFile(level, 'task2ModelPrompts');
    if (prompts) for (const [k, v] of parseTaskPrompts(prompts, `${TASK2_MODEL_PREFIX}${level}-`)) levelTask2Prompts.set(k, v);
  }
}

/** あるレベルの、ある種類の題材(レベル別のファイルに書いたもの) */
export function getLevelFileTopics(level: string, name: 'task2Models' | 'task1Topics' | 'collocationTopics' | 'speakingTopics'): PresetTopic[] {
  loadLevelContent();
  return levelTopicCache!.get(`${level}/${name}`) ?? [];
}

function allLevelTopics(): PresetTopic[] {
  loadLevelContent();
  return [...levelTopicCache!.values()].flat();
}

/** 内蔵の題材すべて(IELTS Task 2・Task 1・TOEFL・チャンク大全・Idiomatic 300・語彙・Speaking・レベル別)と和訳 */
export function getAllPresetTopics(): PresetTopic[] {
  return [
    ...allLevelTopics(),
    ...getPresetTopics(),
    ...getTask2ModelTopics(),
    ...getTask1Topics(),
    ...getToeflTopics(),
    ...getChunkTopics(),
    ...getIdiomaticTopics(),
    ...getCollocationTopics(),
    ...getSpeakingTopics(),
  ];
}

export function getAllPresetTranslations(): Map<string, string[]> {
  loadLevelContent();
  allTranslationCache ??= new Map([
    ...levelTranslationCache!,
    ...getPresetTranslations(),
    ...getTask1Translations(),
    ...getToeflTranslations(),
    ...getChunkTranslations(),
    ...(BAND6
      ? [
          ...parseTranslations(task2ModelTranslationsRaw, TASK2_MODEL_PREFIX),
          ...parseTranslations(collocationTranslationsRaw, COLLOCATION_PREFIX),
          ...parseTranslations(speakingTranslationsRaw, SPEAKING_PREFIX),
        ]
      : []),
  ]);
  return allTranslationCache;
}

/**
 * エッセイの型(For instance・However など)と数値を穴にしないかどうか。
 * チャンク大全と Idiomatic 300 は、そうした表現そのものが覚える対象なので外さない
 */
export function skipsTemplates(entry: Entry): boolean {
  return ![CHUNK_PREFIX, IDIOMATIC_PREFIX, COLLOCATION_PREFIX, SPEAKING_PREFIX].some((p) => entry.presetId?.startsWith(p));
}

/** Task 1 の題材の図(SVG のソース)。図の無い題材なら null */
export function getTask1Figure(presetId: string | undefined): string | null {
  if (!presetId?.startsWith(TASK1_PREFIX)) return null;
  // レベル別の Task 1(task1-l2-4)も、同じ番号の図を使う
  const num = /(\d+)$/.exec(presetId)?.[1];
  return num ? (task1Figures[`${TASK1_FIGURE_DIR}/${num}.svg`] ?? null) : null;
}

/** 題材の上部に固定する図。自分で添付した図を優先し、無ければ内蔵の Task 1 の図(自分専用版・みんな向け版のみ) */
export function entryFigure(entry: Entry): string | null {
  if (entry.figure) return entry.figure;
  const svg = HAS_PRESETS ? getTask1Figure(entry.presetId) : null;
  return svg ? svgDataUrl(svg) : null;
}

/** TOEFL の問題文(Email と Academic Discussion) */
export interface TaskPrompt {
  /** 問題を選ぶときの名前(Email は件名) */
  title: string;
  /** To: や Subject: の行(IELTS Task 2 は Type: の行) */
  headers: string[];
  /** 状況の説明と指示文 */
  paragraphs: string[];
  /** 満たすべき要件 */
  requirements: string[];
  /** Academic Discussion の教授と学生の投稿(Email では空) */
  posts: { name: string; text: string }[];
}

/** Academic Discussion の問題の ID の接頭辞(Email の問題の ID は内蔵題材の presetId と同じ toefl-番号) */
export const DISCUSSION_PREFIX = 'toefl-discussion-';

/**
 * 「**番号**」の見出しの下に、To:/Subject:/Type: の行・説明・「- 」で始まる要件が並んだテキストを読む。
 * 「Title: 」は選ぶときの名前、「@名前: 」は Academic Discussion の投稿
 */
export function parseTaskPrompts(raw: string, idPrefix: string): Map<string, TaskPrompt> {
  const map = new Map<string, TaskPrompt>();
  let current: TaskPrompt | null = null;
  for (const line of raw.split(/\r?\n/).map((l) => l.trim())) {
    const heading = /^\*\*(\d+)\*\*$/.exec(line);
    const post = /^@([^:]+):\s*(.+)$/.exec(line);
    if (heading) {
      current = { title: '', headers: [], paragraphs: [], requirements: [], posts: [] };
      map.set(`${idPrefix}${heading[1]}`, current);
    } else if (!current || !line) {
      continue;
    } else if (post) {
      current.posts.push({ name: post[1]!.trim(), text: post[2]! });
    } else if (line.startsWith('Title:')) {
      current.title = line.slice(6).trim();
    } else if (line.startsWith('- ')) {
      current.requirements.push(line.slice(2));
    } else if (/^(To|Subject|Type):/.test(line)) {
      current.headers.push(line);
      if (line.startsWith('Subject:') && !current.title) current.title = line.slice(8).trim();
    } else {
      current.paragraphs.push(line);
    }
  }
  return map;
}

function toeflEmailPrompts(): Map<string, TaskPrompt> {
  toeflPrompts ??= BAND6 ? new Map() : parseTaskPrompts(toeflPromptsRaw, TOEFL_PREFIX);
  return toeflPrompts;
}

function toeflDiscussionPrompts(): Map<string, TaskPrompt> {
  toeflDiscussions ??= BAND6 ? new Map() : parseTaskPrompts(toeflDiscussionsRaw, DISCUSSION_PREFIX);
  return toeflDiscussions;
}

/** TOEFL の Email の題材の問題文。問題文の無い題材なら null */
export function getToeflPrompt(presetId: string | undefined): TaskPrompt | null {
  if (!presetId?.startsWith(TOEFL_PREFIX)) return null;
  return toeflEmailPrompts().get(presetId) ?? null;
}

/** 問題の ID(Email は toefl-番号、Academic Discussion は toefl-discussion-番号)から問題文を引く */
export function getTaskPrompt(promptId: string | undefined): TaskPrompt | null {
  if (!promptId) return null;
  return toeflDiscussionPrompts().get(promptId) ?? toeflEmailPrompts().get(promptId) ?? null;
}

/** 登録するときに選べる問題(公開版。問題は固定で、本文は自由に入力する) */
export function getTaskPromptChoices(): { group: string; options: { id: string; label: string }[] }[] {
  const options = (map: Map<string, TaskPrompt>, kind: string) =>
    [...map].map(([id, p], i) => ({ id, label: `${kind} ${i + 1}: ${p.title}` }));
  return [
    { group: 'TOEFL Email', options: options(toeflEmailPrompts(), 'Email') },
    { group: 'TOEFL Academic Discussion', options: options(toeflDiscussionPrompts(), 'Discussion') },
  ];
}

/**
 * IELTS Task 2 の題材の問題文(自分専用版のみ)。Type: の行が賛成反対・両論＋意見・メリットデメリットのどれか。
 * みんな向けの IELTS 版の本文は元の型のままなので出さない
 */
export function getTask2Prompt(presetId: string | undefined): TaskPrompt | null {
  task2Prompts ??= BAND6 ? new Map() : parseTaskPrompts(task2PromptsRaw, 'topic-');
  return (presetId && task2Prompts.get(presetId)) || null;
}

/** Task 2 の全文モデルエッセイの問題文(Type: の行が型の名前) */
export function getTask2ModelPrompt(presetId: string | undefined): TaskPrompt | null {
  if (!presetId?.startsWith(TASK2_MODEL_PREFIX)) return null;
  task2ModelPrompts ??= BAND6 ? parseTaskPrompts(task2ModelPromptsRaw, TASK2_MODEL_PREFIX) : new Map();
  loadLevelContent();
  return task2ModelPrompts.get(presetId) ?? levelTask2Prompts!.get(presetId) ?? null;
}

/** Speaking の質問(Part 1・3 は質問の一覧、Part 2 はトピックカード) */
export function getSpeakingPrompt(presetId: string | undefined): TaskPrompt | null {
  if (!presetId?.startsWith(SPEAKING_PREFIX)) return null;
  speakingPrompts ??= BAND6 ? parseTaskPrompts(speakingPromptsRaw, SPEAKING_PREFIX) : new Map();
  // レベル別の答え(speaking-l1-5)も、質問は共通の speaking-5 を使う
  return speakingPrompts.get(presetId.replace(/-l\d-/, '-')) ?? null;
}

/** 題材の上部に固定する問題文。自分で選んだ問題を優先し、無ければ内蔵の TOEFL・IELTS Task 2・Speaking の題材の問題文 */
export function entryPrompt(entry: Entry): TaskPrompt | null {
  if (entry.promptId) return getTaskPrompt(entry.promptId);
  if (!HAS_PRESETS) return null;
  return (
    getToeflPrompt(entry.presetId) ??
    getTask2Prompt(entry.presetId) ??
    getTask2ModelPrompt(entry.presetId) ??
    getSpeakingPrompt(entry.presetId)
  );
}

/**
 * 内蔵題材から追加した英文の改行位置(行の最後のトークンのインデックス → 段落の切れ目なら true)。
 * 登録時にはトークンしか保存していないので、元の題材から割り出す。本文を編集していたら出さない。
 */
export function getPresetLineBreaks(entry: Entry): Map<number, boolean> {
  const topic = entry.presetId ? getAllPresetTopics().find((t) => t.presetId === entry.presetId) : undefined;
  if (!topic) return new Map();
  const total = parseMarkedText(topic.text).tokens.length;
  return total === entry.tokens.length ? lineBreaks(topic.text) : new Map();
}

/** 英文の改行位置。本文を編集した(または改行つきで登録した)英文は保存した位置、それ以外は内蔵題材の本文から */
export function entryLineBreaks(entry: Entry): Map<number, boolean> {
  if (entry.breaks) return new Map(entry.breaks);
  return HAS_PRESETS ? getPresetLineBreaks(entry) : new Map();
}

/** 内蔵題材の元の本文とマーキングに戻した英文(固定・除外・和訳の修正は消す)。元の題材が無ければ null */
export function restoredPresetEntry(entry: Entry): { entry: Entry; ranges: MarkingRange[] } | null {
  const topic = entry.presetId ? getAllPresetTopics().find((t) => t.presetId === entry.presetId) : undefined;
  if (!topic) return null;
  const { tokens, ranges } = parseMarkedText(topic.text);
  return {
    entry: { ...entry, tokens, pinned: undefined, excluded: undefined, glosses: undefined, breaks: undefined, edited: undefined },
    ranges,
  };
}
