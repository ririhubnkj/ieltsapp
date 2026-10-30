/**
 * Writing の本番形式の演習で、書き終えた答案を機械的に点検する(語数・段落・型の書き出し・接続表現など)。
 * 文法や内容の良し悪しは判定できないので、形の上で直せる点だけを出す。
 * あわせて、問題の型の判定と、AI に添削を頼むためのプロンプトもここで作る
 */
import { tokenize, isWordToken } from './tokenize';
import { CRITERIA, splitTemplateLine, type WritingTask, type WritingTemplate } from './writingTemplates';

export interface CheckItem {
  label: string;
  ok: boolean;
  detail: string;
}

/** 最低語数(Task 1 は150語、Task 2 は250語) */
export const MIN_WORDS: Record<WritingTask, number> = { task1: 150, task2: 250 };
/** 制限時間(分) */
export const EXAM_MINUTES: Record<WritingTask, number> = { task1: 20, task2: 40 };

const PARAGRAPHS = 4;
const MIN_LINKERS = 4;
const LONG_SENTENCE = 40;
const REPEAT_LIMIT = 5;

export const LINKING_WORDS = [
  'however',
  'moreover',
  'additionally',
  'in addition',
  'furthermore',
  'firstly',
  'secondly',
  'finally',
  'for instance',
  'for example',
  'as a result',
  'in contrast',
  'on the other hand',
  'meanwhile',
  'therefore',
  'consequently',
  'similarly',
  'although',
  'whereas',
  'while',
  'despite',
  'overall',
  'in conclusion',
  'after that',
  'to begin with',
] as const;

const STOPWORDS = new Set(
  (
    'the a an and or but if so as at by for from in into of on onto to with without about above below over under ' +
    'than then that this these those there here it its it’s is are was were be been being am do does did done ' +
    'have has had having will would can could may might must shall should not no nor also very more most less ' +
    'least much many such some any all each every both either neither other another own same few one two three ' +
    'which who whom whose what when where why how while although because since until though whereas however ' +
    'i me my mine we us our ours you your yours he him his she her hers they them their theirs ' +
    'just only even still yet too again further once well rather quite around between through during before after ' +
    'up down out off per via while whether'
  ).split(/\s+/),
);

/** 答案の語数(8.4 や 1,550 は1語) */
export function countWords(text: string): number {
  return tokenize(text).filter(isWordToken).length;
}

/** 段落(改行で区切る。空行は無視) */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** 文(. ! ? の後に空白か終わりが来るところで区切る。8.4 のような小数では切らない) */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])["'”’)]?\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) > 0);
}

/** 小文字にして、記号を空白に置き換えたもの(書き出しの照合用) */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9']+/g, ' ')
    .replace(/'/g, '')
    .trim();
}

const GAP = null;

/**
 * 型の段落の1行目から、決まった書き出し(最初の3語まで)を取り出す。
 * 「The (graph の種類) shows」のように途中に自分で埋める部分があれば、そこは何語か入ってよいものとして扱う。
 * 2語そろったあとに埋める部分が来たら、そこで打ち切る(Turning to (エリアB), 〜 has → Turning to)。
 * 返す配列の null は埋める部分
 */
export function openingPattern(line: string): (string | null)[] {
  const items: (string | null)[] = [];
  let words = 0;
  for (const part of splitTemplateLine(line)) {
    if (words >= 3) break;
    if (part.slot) {
      if (words >= 2) break;
      if (items.length > 0 && items[items.length - 1] !== GAP) items.push(GAP);
      continue;
    }
    // 日本語の説明が地の文に混ざっていたら、そこで書き出しを打ち切る
    const fixed = part.text.split(/[^\x20-\x7e’]/)[0]!;
    for (const w of normalize(fixed).split(' ').filter(Boolean)) {
      if (words >= 3) break;
      items.push(w);
      words++;
    }
    if (fixed !== part.text) break;
  }
  while (items.length > 0 && items[items.length - 1] === GAP) items.pop();
  return items;
}

/** 書き出しを画面に出す形(埋める部分は 〜) */
export function openingLabel(pattern: (string | null)[]): string {
  const text = pattern.map((w) => w ?? '〜').join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 4文字以上の語は、末尾の s の有無を問わない(The pie charts show / The map shows) */
function wordSource(w: string): string {
  if (w.length < 4) return escapeRegExp(w);
  return escapeRegExp(w.endsWith('s') ? w.slice(0, -1) : w) + 's?';
}

/** 答案(正規化済み)に書き出しがあるか。埋める部分は1〜6語まで */
export function hasOpening(normalizedEssay: string, pattern: (string | null)[]): boolean {
  if (pattern.length === 0) return true;
  const source = pattern.map((w) => (w === GAP ? '(?: \\S+){1,6}' : ' ' + wordSource(w))).join('');
  return new RegExp(`(?:^|\\s)${source.slice(1)}(?= |$)`).test(normalizedEssay);
}

/** 文中の数値(4.5, 1,550, 30% など) */
function countNumbers(text: string): number {
  return (text.match(/\d+(?:[.,]\d+)*/g) ?? []).length;
}

/**
 * 5回以上使った内容語(多い順)。
 * 問題文に出てくる語(テーマの語)はくり返しが避けられないので、ignore に渡して数えない
 */
export function repeatedWords(text: string, ignore = '', limit = REPEAT_LIMIT): { word: string; count: number }[] {
  const ignored = new Set(normalize(ignore).split(' '));
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    if (!/^[A-Za-z][A-Za-z'’-]*$/.test(token)) continue;
    const word = token.toLowerCase().replace(/’/g, "'");
    if (word.length < 3 || STOPWORDS.has(word) || /'/.test(word) || ignored.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= limit)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word, count]) => ({ word, count }));
}

/** 使った接続表現(重複なし、出てくる順) */
export function linkingWordsUsed(text: string): string[] {
  const norm = ` ${normalize(text)} `;
  return LINKING_WORDS.map((w) => ({ w, at: norm.indexOf(` ${w} `) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.w);
}

/** 文の長さが単調か(ある長さ±3語に70%を超える文が集まっていれば単調)。4文未満は判定しない */
export function isMonotonous(lengths: number[]): boolean {
  if (lengths.length < 4) return false;
  const most = Math.max(...lengths.map((n) => lengths.filter((m) => Math.abs(m - n) <= 3).length));
  return most / lengths.length > 0.7;
}

const CONTRACTION_RE =
  /\b(?:[a-z]+n['’]t|(?:i|you|we|they|he|she|it|that|there|here|what|who|let)['’](?:s|re|ll|ve|d|m)|i['’]m)\b/gi;

/** 短縮形(don't, it's など) */
export function contractions(text: string): string[] {
  return [...new Set((text.match(CONTRACTION_RE) ?? []).map((c) => c.toLowerCase().replace(/’/g, "'")))];
}

/** 一人称(I / me / my / we / our) */
export function firstPersonCount(text: string): number {
  return tokenize(text).filter((t) => t === 'I' || /^(me|my|mine|we|our|ours)$/i.test(t)).length;
}

const POSITION_RE =
  /\bI\s+(?:(?:strongly|firmly|completely|totally|fully|partly|partially|largely)\s+)?(?:agree|disagree)\b|\bI\s+(?:personally|firmly|strongly)\s+believe\b/i;

/** 自分の立場を述べる必要のある型(両論＋意見・賛成反対) */
export function needsPosition(templateId: string | undefined): boolean {
  return templateId === 'both-views' || templateId === 'agree-disagree';
}

export interface CheckInput {
  task: WritingTask;
  text: string;
  template?: WritingTemplate | null;
  /** 問題文(ここに出てくる語は、くり返しの点検で数えない) */
  question?: string;
}

/** 答案を点検する。並びは、語数 → 構成 → 型 → 内容の形 → 語彙・文 */
export function checkEssay({ task, text, template, question = '' }: CheckInput): CheckItem[] {
  const items: CheckItem[] = [];
  const words = countWords(text);
  const min = MIN_WORDS[task];
  const paragraphs = splitParagraphs(text);
  const sentences = splitSentences(text);
  const norm = normalize(text);

  items.push({
    label: `語数 ${words}語(最低 ${min}語)`,
    ok: words >= min,
    detail:
      words >= min
        ? '最低語数を満たしています。'
        : `あと${min - words}語足りません。最低語数に届かないと Task ${task === 'task1' ? 'Achievement' : 'Response'} が減点されます。`,
  });

  items.push({
    label: `段落の数 ${paragraphs.length}(目安 ${PARAGRAPHS})`,
    ok: paragraphs.length === PARAGRAPHS,
    detail:
      paragraphs.length === PARAGRAPHS
        ? '型どおり4段落に分かれています。'
        : paragraphs.length < PARAGRAPHS
          ? '段落が少なすぎます。段落の間は改行で区切り、型の4段落に分けてください。'
          : '段落が多すぎます。型の4段落にまとめてください。',
  });

  if (template) {
    const patterns = template.paragraphs.map((p) => openingPattern(p.lines[0] ?? '')).filter((p) => p.length > 0);
    const missing = patterns.filter((p) => !hasOpening(norm, p)).map(openingLabel);
    items.push({
      label: `型の書き出し ${patterns.length - missing.length}/${patterns.length}`,
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `「${template.name}」の型の書き出しをすべて使えています。`
          : `次の書き出しが見つかりません: ${missing.join(' / ')}`,
    });
  }

  if (task === 'task1') {
    const overview = paragraphs[1] ?? '';
    const overviewHasDigits = /\d/.test(overview);
    items.push({
      label: 'Overview(第2段落)に数字を入れない',
      ok: !!overview && !overviewHasDigits,
      detail: !overview
        ? '第2段落がありません。第2段落に全体の傾向(Overview)を書いてください。'
        : overviewHasDigits
          ? 'Overview に数字が入っています。数字は第3・4段落に回し、Overview は全体の傾向だけにします。'
          : 'Overview に数字が入っていません。',
    });
    // 地図と図解は数字の無い図が多いので、数字の点検はグラフと表だけにする
    const numbers = countNumbers(paragraphs.slice(2, 4).join(' '));
    if (template?.id !== 'map' && template?.id !== 'process') items.push({
      label: `第3・4段落の数字 ${numbers}個(3個以上)`,
      ok: numbers >= 3,
      detail:
        numbers >= 3
          ? '詳しい段落で数字を取り上げています。'
          : '第3・4段落で、始まり・終わり・最大値などの数字を3つ以上入れて比べてください。',
    });
  } else {
    if (needsPosition(template?.id)) {
      const ok = POSITION_RE.test(text);
      items.push({
        label: '自分の立場をはっきり書く',
        ok,
        detail: ok
          ? '自分の立場を示す表現があります。'
          : 'この型では自分の立場が必要です。I strongly agree / disagree や I personally believe that 〜 で立場を明確にしてください。',
      });
    }
    const last = normalize(paragraphs[paragraphs.length - 1] ?? '');
    const ok = paragraphs.length > 1 && (last.startsWith('in conclusion') || last.startsWith('in my opinion'));
    items.push({
      label: '結論の書き出し',
      ok,
      detail: ok
        ? '最後の段落が In conclusion / In my opinion で始まっています。'
        : '最後の段落を In conclusion, 〜 か In my opinion, 〜 で始め、結論だと分かるようにしてください。',
    });
  }

  const linkers = linkingWordsUsed(text);
  items.push({
    label: `接続表現 ${linkers.length}種類(${MIN_LINKERS}種類以上)`,
    ok: linkers.length >= MIN_LINKERS,
    detail:
      (linkers.length > 0 ? `使った表現: ${linkers.join(', ')}。` : '') +
      (linkers.length >= MIN_LINKERS
        ? ''
        : 'However, Moreover, For instance, As a result などで文と文のつながりを示してください。'),
  });

  const repeated = repeatedWords(text, question);
  items.push({
    label: '同じ語のくり返し',
    ok: repeated.length === 0,
    detail:
      repeated.length === 0
        ? `同じ内容語を${REPEAT_LIMIT}回以上使っていません(問題文にある語は数えていません)。`
        : `${repeated.map((r) => `${r.word}(${r.count}回)`).join(', ')}。言い換えや代名詞を使うと Lexical Resource の評価が上がります。`,
  });

  const lengths = sentences.map(countWords);
  const average = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const monotonous = isMonotonous(lengths);
  items.push({
    label: `文の長さ 平均${average.toFixed(1)}語(${lengths.length}文)`,
    ok: !monotonous && lengths.length > 0,
    detail:
      lengths.length === 0
        ? '文がありません。'
        : monotonous
          ? '同じくらいの長さの文が続いています。短い文と、接続詞や関係詞でつないだ長い文を混ぜてください。'
          : '短い文と長い文が混ざっています。',
  });

  const long = lengths.filter((n) => n > LONG_SENTENCE).length;
  items.push({
    label: `長すぎる文(${LONG_SENTENCE}語超)`,
    ok: long === 0,
    detail: long === 0 ? '長すぎる文はありません。' : `${long}文あります。2文に分けると読みやすくなり、文法のミスも減ります。`,
  });

  const cs = contractions(text);
  items.push({
    label: '短縮形を使わない',
    ok: cs.length === 0,
    detail:
      cs.length === 0
        ? '短縮形は使っていません。'
        : `${cs.join(', ')} は話し言葉です。do not, it is のように省略せずに書いてください。`,
  });

  if (task === 'task1') {
    const n = firstPersonCount(text);
    items.push({
      label: '一人称(I / my / we)を使わない',
      ok: n === 0,
      detail:
        n === 0
          ? 'Task 1 で一人称を使っていません。'
          : `一人称が${n}回あります。Task 1 は図表の説明なので、自分の意見や I / my / we は入れません。`,
    });
  }

  return items;
}

// --- 問題の型の判定 ---

const TASK2_TYPES: Record<string, string> = {
  'advantages and disadvantages': 'adv-disadv',
  'two-part question': 'two-part',
  'problem and solution': 'problem-solution',
  'discuss both views': 'both-views',
  'agree or disagree': 'agree-disagree',
};

/** Task 2 の問題文の Type: の行(または型の名前)から、型の ID を引く */
export function task2TemplateId(headers: string[]): string | null {
  for (const h of headers) {
    const type = h.replace(/^Type:\s*/i, '').trim().toLowerCase();
    if (TASK2_TYPES[type]) return TASK2_TYPES[type];
  }
  return null;
}

/** Task 2 の Type: の行の値 */
export function task2TypeLabel(headers: string[]): string {
  return headers.find((h) => /^Type:/i.test(h))?.replace(/^Type:\s*/i, '').trim() ?? '';
}

/** Task 1 の図の種類(題材の名前「1. 表｜医療センターの評価」の 表) */
export function task1Kind(title: string): string {
  return title.replace(/^\d+\.\s*/, '').split('｜')[0]!.trim();
}

/**
 * Task 1 の型の ID。地図は map、図解は process。表・グラフは時間の変化があれば trend、
 * 無いもの(1番の医療センターの評価、5番の旅行者の余暇)は compare
 */
export function task1TemplateId(presetId: string, title: string): string {
  const kind = task1Kind(title);
  if (kind === '地図') return 'map';
  if (kind === '図解') return 'process';
  return /-(?:1|5)$/.test(presetId) ? 'compare' : 'trend';
}

/** 本文の印({{ }} と {{+ }})を外す */
export function stripMarks(text: string): string {
  return text.replace(/\{\{\+?/g, '').replace(/\}\}/g, '');
}

/** モデルエッセイの最初の文(図の説明) */
export function firstSentence(text: string): string {
  const first = splitParagraphs(stripMarks(text))[0] ?? '';
  return splitSentences(first)[0] ?? first;
}

export const TASK1_INSTRUCTION =
  'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.';

/**
 * Task 1 の問題文を、モデルエッセイの最初の文から作る。
 * 「The line graph shows X.」→「The line graph below shows X. Summarise …」
 */
export function task1QuestionFromEssay(text: string): string {
  let sentence = firstSentence(text).trim();
  if (!sentence) return TASK1_INSTRUCTION;
  if (!/[.!?]$/.test(sentence)) sentence += '.';
  const withBelow = sentence.replace(
    /^(The\s+(?:[A-Za-z-]+\s+){0,3}?)(shows?|illustrates?|compares?|gives?|provides?|presents?|describes?)\b/,
    '$1below $2',
  );
  return `${withBelow} ${TASK1_INSTRUCTION}`;
}

// --- AI 添削用のプロンプト ---

export interface AiPromptInput {
  task: WritingTask;
  /** 問題文(Task 1 は作った問題文) */
  question: string;
  /** Task 1 の図の説明(モデルエッセイの最初の文) */
  chartDescription?: string;
  /** 目標バンド(レベルのバンド) */
  targetBand: string;
  essay: string;
  template?: WritingTemplate | null;
  minutes?: number;
  seconds?: number;
}

/** Claude や ChatGPT にそのまま貼り付けて添削を頼むためのプロンプト */
export function buildAiPrompt(input: AiPromptInput): string {
  const { task, question, chartDescription, targetBand, essay, template, seconds } = input;
  const taskName = task === 'task1' ? 'Task 1' : 'Task 2';
  const words = countWords(essay);
  const lines: string[] = [];
  lines.push('あなたは IELTS Writing の採点経験が豊富な試験官です。');
  lines.push(
    `以下は、日本人の学習者が IELTS Academic Writing ${taskName} の本番形式(制限時間${EXAM_MINUTES[task]}分)で書いた答案です。公式の Band Descriptors に沿って採点し、添削してください。`,
  );
  lines.push('');
  lines.push(`## 問題 (${taskName})`);
  if (task === 'task1') {
    lines.push('図表の画像は別に添付します(添付が無い場合は、次の説明をもとに図表の内容を想定してください)。');
    if (chartDescription) lines.push(`図表の説明: ${chartDescription}`);
    lines.push('');
  }
  lines.push(question);
  lines.push('');
  lines.push('## 学習者について');
  lines.push(`- 目標バンド: ${targetBand}`);
  lines.push(`- 語数: ${words}語(最低 ${MIN_WORDS[task]}語)`);
  if (seconds !== undefined) lines.push(`- かかった時間: ${Math.floor(seconds / 60)}分${seconds % 60}秒`);
  if (template) {
    lines.push(`- 使おうとした型: ${template.name}`);
    template.paragraphs.forEach((p) => lines.push(`  ${p.label} ${p.lines.join(' ')}`));
  }
  lines.push('');
  lines.push('## 採点基準 (4項目)');
  CRITERIA[task].forEach((c, i) => lines.push(`${i + 1}. ${c.name}(${c.nameJa})`));
  lines.push('');
  lines.push('## 答案 (Essay)');
  lines.push('"""');
  lines.push(essay.trim());
  lines.push('"""');
  lines.push('');
  lines.push('## お願いしたいこと');
  lines.push(
    '1. 4つの採点基準それぞれのバンド(0.5刻み)と Overall のバンドを付け、それぞれの理由を日本語で短く書いてください。',
  );
  lines.push(
    '2. 点数に最も影響する修正を5つ選び、「元の文 → 修正した文」の形で示し、短い日本語の理由を付けてください。',
  );
  lines.push(
    '3. 型(段落の役割や決まった書き出し)の使い方に問題があれば指摘してください。' +
      (task === 'task1' ? 'Overview の書き方と数字の選び方も見てください。' : '立場の示し方と結論の書き方も見てください。'),
  );
  lines.push('4. この答案で使える、より良い語彙・コロケーションを5つ、英語と日本語の意味つきで挙げてください。');
  lines.push(
    '5. 最後に、この答案を、あなたが付けた Overall より1つ上のバンドのレベルで書き直してください(内容と段落の構成はできるだけ保ってください)。',
  );
  lines.push('');
  lines.push('説明は日本語で、英文の引用・修正文・書き直しは英語でお願いします。');
  return lines.join('\n');
}
