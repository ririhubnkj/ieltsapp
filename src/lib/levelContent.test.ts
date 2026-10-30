import { describe, expect, it } from 'vitest';
import { parseMarkedText, parsePresetTopics } from './presets';
import { isWordToken, tokenize } from './tokenize';
import { parseJpLine, parseTranslations, sentenceIndices } from './translation';
import { parseTaskPrompts } from './presetLibrary';
import { splitTemplateLine, TEMPLATES } from './writingTemplates';
import sharedSpeakingPrompts from '../data/speakingPrompts.txt?raw';

/**
 * レベル別の題材(src/data/levels/<level>/)の検証。
 * 各レベルに task2Models・task1Topics・collocationTopics・speakingTopics と和訳、reading/*.json を置く
 */
const raw = import.meta.glob<string>('../data/levels/*/*.txt', { query: '?raw', import: 'default', eager: true });
const file = (level: string, name: string) => raw[`../data/levels/${level}/${name}.txt`];
const LEVELS = ['l1', 'l2', 'l3', 'l4', 'l5'];

/** 英文1文に和訳1行が対応し、各行の【 】がその英文の表現にちょうど対応しているか */
function expectAligned(text: string | undefined, translations: string | undefined, label: string) {
  if (!text) return;
  expect(translations, `${label}: 和訳ファイルが無い`).toBeDefined();
  const topics = parsePresetTopics(text, 'x-');
  const map = parseTranslations(translations!, 'x-');
  for (const topic of topics) {
    const lines = map.get(topic.presetId);
    expect(lines, `${label} ${topic.title}: 和訳が無い`).toBeDefined();
    const { tokens, expressions } = parseMarkedText(topic.text);
    expect(topic.text.split('{{').length, `${label} ${topic.title}: {{ }} の数`).toBe(topic.text.split('}}').length);
    const sentenceOf = sentenceIndices(tokens);
    expect(lines, `${label} ${topic.title}: 文の数と和訳の行数`).toHaveLength(sentenceOf[sentenceOf.length - 1]! + 1);
    lines!.forEach((line, s) => {
      const enCount = expressions.filter((e) => sentenceOf[e[0]!] === s).length;
      const jp = parseJpLine(line).flatMap((seg) => (seg.expr === undefined ? [] : [seg.expr]));
      expect([...new Set(jp)].sort(), `${label} ${topic.title} / ${s + 1}: ${line}`).toEqual([...Array(enCount).keys()]);
    });
  }
}

describe.each(LEVELS)('level %s', (level) => {
  it('aligns every translation with its English text', () => {
    for (const name of ['task2Models', 'task1Topics', 'collocationTopics', 'speakingTopics'])
      expectAligned(file(level, name), file(level, name.replace(/Topics$|Models$/, (m) => (m === 'Models' ? 'ModelTranslations' : 'Translations'))), `${level}/${name}`);
  });

  it('follows the Task 2 templates, with a typed question for every essay', () => {
    const text = file(level, 'task2Models');
    if (!text) return;
    const prompts = parseTaskPrompts(file(level, 'task2ModelPrompts') ?? '', 'x-');
    for (const t of parsePresetTopics(text, 'x-')) {
      const paras = t.text.split(/\n\s*\n/);
      expect(paras, t.title).toHaveLength(4);
      expect(t.text.startsWith('It is often argued that'), t.title).toBe(true);
      expect(prompts.get(t.presetId)?.headers[0], t.title).toMatch(
        /^Type: (Advantages and disadvantages|Two-part question|Problem and solution|Discuss both views|Agree or disagree)$/,
      );
      // 型ごとの決まった書き出し(資料の型の各段落の最初の2語)がそろっている
      // 句読点を除いた語の並びで比べる(In conclusion, の読点などは問わない)
      const words = (text: string) => tokenize(text).filter(isWordToken).join(' ');
      const essay = words(parseMarkedText(t.text).tokens.join(' '));
      const tp = TEMPLATES.task2.find((x) =>
        x.paragraphs.every((p) => essay.includes(words(splitTemplateLine(p.lines[0]!)[0]!.text).split(' ').slice(0, 3).join(' '))),
      );
      expect(tp, t.title).toBeDefined();
    }
  });

  it('keeps the Task 1 template and a number-free overview', () => {
    const text = file(level, 'task1Topics');
    if (!text) return;
    for (const t of parsePresetTopics(text, 'x-')) {
      const paras = t.text.split(/\n\s*\n/);
      expect(paras, t.title).toHaveLength(4);
      expect(paras[1]!.startsWith('Overall, it is clear that'), t.title).toBe(true);
      expect(/\d/.test(paras[1]!), t.title).toBe(false);
      expect(paras[2]!.startsWith('Looking first at'), t.title).toBe(true);
      expect(paras[3]!.startsWith('Turning to'), t.title).toBe(true);
    }
  });

  it('gives every Speaking answer a question set from the shared prompts', () => {
    const text = file(level, 'speakingTopics');
    if (!text) return;
    const shared = parseTaskPrompts(sharedSpeakingPrompts, 'x-');
    for (const t of parsePresetTopics(text, 'x-')) {
      const prompt = shared.get(t.presetId);
      expect(prompt, `${t.title}: 共通の質問(src/data/speakingPrompts.txt)の番号に無い`).toBeDefined();
      if (!t.title.includes('Part 2')) expect(t.text.split(/\n\s*\n/), t.title).toHaveLength(prompt!.requirements.length);
    }
  });
});
