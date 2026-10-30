import { describe, expect, it } from 'vitest';
import { getAllPresetTopics, getAllPresetTranslations } from './presetLibrary';
import { IDIOMATIC_PREFIX, parseMarkedText, parsePresetTopics, presetEntriesToAdd, TASK1_PREFIX, type PresetTopic } from './presets';
import { buildEntryTranslation, parseJpLine, parseTranslations, sentenceIndices } from './translation';
import band6Task1Raw from '../data/band6/task1Topics.txt?raw';
import band6Task1TranslationsRaw from '../data/band6/task1Translations.txt?raw';
import band6Task2Raw from '../data/band6/task2Topics.txt?raw';
import band6Task2TranslationsRaw from '../data/band6/task2Translations.txt?raw';

describe('parseJpLine', () => {
  it('numbers the marked parts in order, with continuations and explicit numbers', () => {
    expect(parseJpLine('A【x】B【+y】C【z】')).toEqual([
      { text: 'A' },
      { text: 'x', expr: 0 },
      { text: 'B' },
      { text: 'y', expr: 0 },
      { text: 'C' },
      { text: 'z', expr: 1 },
    ]);
    expect(parseJpLine('【2:後】と【1:先】').map((s) => s.expr)).toEqual([1, undefined, 0]);
  });
});

/** 英文1文に和訳1行が対応し、各行の【 】がその英文の表現にちょうど対応しているか */
function expectAligned(topics: PresetTopic[], translations: Map<string, string[]>) {
    for (const topic of topics) {
      const lines = translations.get(topic.presetId)!;
      const { tokens, expressions } = parseMarkedText(topic.text);
      const sentenceOf = sentenceIndices(tokens);
      expect(lines, topic.title).toHaveLength(sentenceOf[sentenceOf.length - 1]! + 1);
      lines.forEach((line, s) => {
        const enCount = expressions.filter((e) => sentenceOf[e[0]!] === s).length;
        const jp = parseJpLine(line).flatMap((seg) => (seg.expr === undefined ? [] : [seg.expr]));
        // 【 】の数と番号が、その英文の表現にちょうど対応している
        expect([...new Set(jp)].sort(), `${topic.title} / ${s + 1}: ${line}`).toEqual(
          [...Array(enCount).keys()],
        );
      });
    }
}

describe('band 6 model answers for the everyone build', () => {
  it('keeps the translations aligned', () => {
    expectAligned(parsePresetTopics(band6Task1Raw, TASK1_PREFIX), parseTranslations(band6Task1TranslationsRaw, TASK1_PREFIX));
    expectAligned(parsePresetTopics(band6Task2Raw), parseTranslations(band6Task2TranslationsRaw));
  });
});

describe('bundled translations', () => {
  // Idiomatic 300 だけは和訳が無い
  const topics = getAllPresetTopics().filter((t) => !t.presetId.startsWith(IDIOMATIC_PREFIX));
  const translations = getAllPresetTranslations();

  it('has one line per English sentence and matches the expressions sentence by sentence', () => {
    expectAligned(topics, translations);
  });

  it('links a freshly added preset entry to its translation', () => {
    const { entries } = presetEntriesToAdd(topics, []);
    for (const entry of entries) {
      const t = buildEntryTranslation(entry, topics, translations);
      expect(t, entry.title).not.toBeNull();
      // 表現の語はすべて、和訳のどこかの部分に対応している
      const jpExprs = new Set(t!.sentences.flat().flatMap((seg) => (seg.expr === undefined ? [] : [seg.expr])));
      for (const e of t!.exprOfToken.values()) expect(jpExprs.has(e)).toBe(true);
    }
  });

  it('keeps the translation after a word is edited, following the unchanged words', () => {
    const { entries } = presetEntriesToAdd(topics.slice(0, 1), []);
    const entry = entries[0]!;
    const before = buildEntryTranslation(entry, topics, translations)!;
    // 先頭の語を2語に書き換えると、後ろの語の位置が1つずつずれる
    const edited = { ...entry, tokens: ['Well', 'now', ...entry.tokens.slice(1)] };
    const after = buildEntryTranslation(edited, topics, translations)!;
    expect(after.sentences).toEqual(before.sentences);
    for (const [i, e] of before.exprOfToken) if (i > 0) expect(after.exprOfToken.get(i + 1)).toBe(e);
  });

  it('gives up when the number of sentences changes', () => {
    const { entries } = presetEntriesToAdd(topics.slice(0, 1), []);
    const edited = { ...entries[0]!, tokens: [...entries[0]!.tokens, 'One', 'more', '.'] };
    expect(buildEntryTranslation(edited, topics, translations)).toBeNull();
  });
});
