export interface Entry {
  id: string;
  createdAt: string;
  tokens: string[];
  title?: string;
  /** 手動で修正した和訳。キーはトークンのインデックス */
  glosses?: Record<string, string>;
  /** 出題割合に関係なく常に穴にするトークンのインデックス */
  pinned?: number[];
  /** 自動の穴埋めでは出題しないトークンのインデックス */
  excluded?: number[];
  /** 内蔵の教材ライブラリから追加した題材のID */
  presetId?: string;
  /** 入っているタブ(自分専用版)。無ければ presetId などから決める */
  deckId?: string;
  /** 自分で添付した図(縮小した画像の data URL)。IELTS Task 1 のグラフなどを上部に固定して表示する */
  figure?: string;
  /** 自分で選んだ TOEFL の問題(公開版)。問題文を上部に固定して表示する */
  promptId?: string;
  /** 本文の改行位置([行の最後のトークンのインデックス, 段落の切れ目か])。無ければ内蔵題材の本文から割り出す */
  breaks?: [number, boolean][];
  /** 本文を自分で書き換えた。内蔵題材の更新で上書きしない */
  edited?: boolean;
}

/** ホームのタブ(自分専用版)。名前は自由に変えられる */
export interface Deck {
  id: string;
  name: string;
}

export interface MarkingRange {
  start: number;
  end: number;
}

export interface MarkingSet {
  entryId: string;
  ranges: MarkingRange[];
}

export interface SessionRecord {
  id: string;
  entryId: string;
  timestamp: string;
  totalQuestions: number;
  correctCount: number;
}

export type QuizMode = 'marked' | 'allWords';

export interface Settings {
  quizRatio: number;
  quizMode?: QuizMode;
  showGlossHints?: boolean;
  /** 自分専用版のタブ。未設定なら既定のタブを使う */
  decks?: Deck[];
  /** タブを保存した時点で知っていた既定のタブ。後から増えた既定のタブだけを足すのに使う */
  knownDeckIds?: string[];
}

export interface AppData {
  schemaVersion: 1;
  entries: Entry[];
  markings: MarkingSet[];
  sessions: SessionRecord[];
  settings: Settings;
}

export interface ExportFileV1 {
  schemaVersion: 1;
  exportedAt: string;
  data: {
    entries: Entry[];
    markings: MarkingSet[];
    sessions: SessionRecord[];
    settings: Settings;
  };
}
