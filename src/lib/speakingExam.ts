/**
 * Speaking の本番形式の練習(試験官の質問 → 時間を計って話す → 録音を聞き直す)の、画面に依存しない部分
 */
import type { TaskPrompt } from './presetLibrary';
import type { PresetTopic } from './presets';

export type SpeakingPart = 1 | 2 | 3;

/** Part 1・3 で1問に話す秒数 */
export const ANSWER_SECONDS: Record<1 | 3, number> = { 1: 30, 3: 60 };
/** Part 2 の準備と、話す時間(2分で打ち切る) */
export const PREP_SECONDS = 60;
export const TALK_SECONDS = 120;

/** 「Type: Speaking Part 2 (...)」の行から Part を読む。読めなければ null */
export function speakingPart(prompt: TaskPrompt): SpeakingPart | null {
  for (const h of prompt.headers) {
    const m = /Part\s*([123])/i.exec(h);
    if (m) return Number(m[1]) as SpeakingPart;
  }
  return null;
}

/**
 * 録音1つごとの質問の文。Part 1・3 は「- 」の質問をそのまま、
 * Part 2 はトピックカードの最初の文(Describe ...)を1つだけ返す
 */
export function examQuestions(prompt: TaskPrompt, part: SpeakingPart): string[] {
  if (part === 2) return [prompt.paragraphs[0] ?? prompt.title];
  return prompt.requirements;
}

/** 試験の流れの1段階。listen は質問の読み上げ、prep は Part 2 の準備、speak は話す(録音する)時間 */
export interface ExamStep {
  kind: 'listen' | 'prep' | 'speak';
  /** 何問目か(0 から) */
  index: number;
  /** 制限時間(秒)。listen は読み上げが終わるまでなので 0 */
  seconds: number;
}

export function examSteps(part: SpeakingPart, questionCount: number): ExamStep[] {
  if (part === 2) {
    return [
      { kind: 'prep', index: 0, seconds: PREP_SECONDS },
      { kind: 'speak', index: 0, seconds: TALK_SECONDS },
    ];
  }
  const seconds = ANSWER_SECONDS[part];
  return Array.from({ length: questionCount }, (_, index): ExamStep[] => [
    { kind: 'listen', index, seconds: 0 },
    { kind: 'speak', index, seconds },
  ]).flat();
}

/** 次の段階の番号。読み上げを使わないときは listen を飛ばす。最後まで終わったら null */
export function nextStepIndex(steps: ExamStep[], current: number, { voice }: { voice: boolean }): number | null {
  for (let i = current + 1; i < steps.length; i++) {
    if (steps[i]!.kind === 'listen' && !voice) continue;
    return i;
  }
  return null;
}

/** 最初の段階の番号(読み上げを使わないなら最初の listen を飛ばす) */
export function firstStepIndex(steps: ExamStep[], { voice }: { voice: boolean }): number | null {
  return nextStepIndex(steps, -1, { voice });
}

/** 残り秒数(切り上げ。0 未満にはしない) */
export function remainingSeconds(limit: number, elapsedMs: number): number {
  return Math.max(0, Math.ceil(limit - elapsedMs / 1000));
}

/** 秒数を m:ss にする */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 録音に使う形式。Chrome・Firefox は audio/webm、iOS Safari は audio/mp4。どれも使えなければ undefined(ブラウザ任せ) */
export const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function pickMimeType(isTypeSupported: (type: string) => boolean): string | undefined {
  return MIME_CANDIDATES.find((t) => {
    try {
      return isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

/** レベル別の presetId(speaking-l2-5)を、質問の共通の ID(speaking-5)にする */
export function basePresetId(presetId: string): string {
  return presetId.replace(/-l\d-/, '-');
}

/** 質問の ID の番号(speaking-5 → 5) */
export function presetNumber(presetId: string): number | null {
  const m = /(\d+)$/.exec(presetId);
  return m ? Number(m[1]) : null;
}

/** このレベルの題材から、同じ質問のモデルアンサーを探す */
export function modelTopicFor(presetId: string, topics: PresetTopic[]): PresetTopic | undefined {
  const base = basePresetId(presetId);
  return topics.find((t) => basePresetId(t.presetId) === base);
}

/** モデルアンサーの本文から {{ }} の印を外す */
export function stripMarkers(text: string): string {
  return text.replace(/\{\{\+?|\}\}/g, '');
}

export interface PromptChoice {
  id: string;
  title: string;
  part: SpeakingPart;
  questionCount: number;
}

/** 選ぶ画面の一覧(Part ごとに、番号の順) */
export function groupByPart(prompts: [string, TaskPrompt][]): Record<SpeakingPart, PromptChoice[]> {
  const groups: Record<SpeakingPart, PromptChoice[]> = { 1: [], 2: [], 3: [] };
  for (const [id, prompt] of prompts) {
    const part = speakingPart(prompt);
    if (!part) continue;
    groups[part].push({ id, title: prompt.title, part, questionCount: part === 2 ? 1 : prompt.requirements.length });
  }
  for (const list of Object.values(groups)) list.sort((a, b) => (presetNumber(a.id) ?? 0) - (presetNumber(b.id) ?? 0));
  return groups;
}

/** 一覧から1つ選ぶ。空なら null */
export function pickRandom<T>(items: T[], random: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

/** 学習記録に残す名前 */
export function sessionTitle(prompt: TaskPrompt, part: SpeakingPart): string {
  return `Speaking Part ${part}: ${prompt.title}`;
}

/** 読み上げの終わりが知らされないときに、次へ進むまでの目安(ミリ秒)。1語0.5秒+余裕4秒 */
export function listenFallbackMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words * 500 + 4000;
}

/** Speaking の4つの評価基準と、自分で確かめる点 */
export const SELF_CHECK: { criterion: string; ja: string; items: string[] }[] = [
  {
    criterion: 'Fluency and Coherence',
    ja: '流暢さと一貫性',
    items: ['長く黙り込まずに話し続けられた', 'so / because / for example などで話をつなげられた'],
  },
  {
    criterion: 'Lexical Resource',
    ja: '語彙',
    items: ['同じ語ばかり繰り返さず、言い換えができた', '話題に合った語句やコロケーションを使えた'],
  },
  {
    criterion: 'Grammatical Range and Accuracy',
    ja: '文法の幅と正確さ',
    items: ['過去形・現在完了などの時制を正しく使い分けた', '関係詞や if などを使った長めの文も言えた'],
  },
  {
    criterion: 'Pronunciation',
    ja: '発音',
    items: ['録音を聞いて、単語がはっきり聞き取れる', '強く言う語と抑揚をつけて、一本調子にならなかった'],
  },
];
