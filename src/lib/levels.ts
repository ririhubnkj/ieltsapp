/**
 * IELTS のレベル(目標バンド)。題材はレベルごとに最初から並べておき、選んだレベルのものだけを出す
 */
import {
  getCollocationTopics,
  getLevelFileTopics,
  getPresetTopics,
  getSpeakingTopics,
  getTask1Topics,
  getTask2ModelTopics,
} from './presetLibrary';
import type { PresetTopic } from './presets';

export type LevelId = 'l1' | 'l2' | 'l3' | 'l4' | 'l5';

export interface Level {
  id: LevelId;
  /** 目標バンド */
  band: string;
  /** 短い呼び名 */
  name: string;
  /** どんな人向けか */
  description: string;
}

export const LEVELS: Level[] = [
  { id: 'l1', band: '4.0–5.0', name: '基礎', description: '短く簡単な文で、型と基本の語を身につける' },
  { id: 'l2', band: '5.0–5.5', name: '初級', description: 'よく使う言い回しで、理由と例を書けるようにする' },
  { id: 'l3', band: '5.5–6.5', name: '中級', description: '型どおりに、正確で読みやすい英文を書く' },
  { id: 'l4', band: '6.5–7.5', name: '中上級', description: '複雑な構文と的確なコロケーションを使いこなす' },
  { id: 'l5', band: '7.5+', name: '上級', description: '洗練された語彙と構文で、論を深める' },
];

export const DEFAULT_LEVEL: LevelId = 'l3';

export function getLevel(id: string | undefined): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS.find((l) => l.id === DEFAULT_LEVEL)!;
}

/** 練習の種類(ホームの下のタブ) */
export type ContentKind = 'task2' | 'task1' | 'vocab' | 'speaking';

/**
 * 内蔵題材のレベル。レベル別のファイルの題材は presetId の中の l1〜l5、
 * それより前からある題材は、Writing(バンド6.0〜6.5の文)を l3、語彙と Speaking(6.5〜7.0)を l4 とする
 */
export function levelOfPresetId(presetId: string | undefined): LevelId | null {
  if (!presetId) return null;
  const m = /-(l[1-5])-/.exec(presetId);
  if (m) return m[1] as LevelId;
  if (/^(topic-|task2model-|task1-)/.test(presetId)) return 'l3';
  if (/^(colloc-|speaking-)/.test(presetId)) return 'l4';
  return null;
}

/** あるレベルの、ある種類の題材(並べる順) */
export function levelTopics(level: LevelId, kind: ContentKind): PresetTopic[] {
  const own = (name: Parameters<typeof getLevelFileTopics>[1]) => getLevelFileTopics(level, name);
  switch (kind) {
    case 'task2':
      // 型ごとの全文モデルを先に、(中級だけにある)本論だけのモデルを後に並べる
      return level === 'l3' ? [...getTask2ModelTopics(), ...getPresetTopics()] : own('task2Models');
    case 'task1':
      return level === 'l3' ? getTask1Topics() : own('task1Topics');
    case 'vocab':
      return level === 'l4' ? getCollocationTopics() : own('collocationTopics');
    case 'speaking':
      return level === 'l4' ? getSpeakingTopics() : own('speakingTopics');
  }
}

/** あるレベルの題材すべて */
export function allLevelTopics(level: LevelId): PresetTopic[] {
  return (['task2', 'task1', 'vocab', 'speaking'] as ContentKind[]).flatMap((k) => levelTopics(level, k));
}

/** Reading の演習のレベル(レベル別のファイルは id が l1-r01 など。それより前の10題は l3 と l4 に分ける) */
export function levelOfPassageId(id: string): LevelId {
  const m = /^(l[1-5])-/.exec(id);
  if (m) return m[1] as LevelId;
  return ['r01', 'r02', 'r03', 'r04', 'r09'].includes(id) ? 'l3' : 'l4';
}
