import { describe, expect, it } from 'vitest';
import { parseMarkedText, parsePresetTopics, SPEAKING_PREFIX, TASK2_MODEL_PREFIX } from './presets';
import { parseTaskPrompts } from './presetLibrary';
import { CRITERIA, splitTemplateLine, TEMPLATES } from './writingTemplates';
import band6Task1Raw from '../data/band6/task1Topics.txt?raw';
import task2ModelRaw from '../data/band6/task2Models.txt?raw';
import task2ModelPromptsRaw from '../data/band6/task2ModelPrompts.txt?raw';
import collocationRaw from '../data/collocationTopics.txt?raw';
import speakingRaw from '../data/speakingTopics.txt?raw';
import speakingPromptsRaw from '../data/speakingPrompts.txt?raw';

const paragraphs = (text: string) => text.split(/\n\s*\n/);

describe('writing templates', () => {
  const task1 = parsePresetTopics(band6Task1Raw, 'task1-');
  const task2 = parsePresetTopics(task2ModelRaw, TASK2_MODEL_PREFIX);

  it('offers four Task 1 types and five Task 2 types, each with four criteria', () => {
    expect(TEMPLATES.task1).toHaveLength(4);
    expect(TEMPLATES.task2).toHaveLength(5);
    expect(CRITERIA.task1).toHaveLength(4);
    expect(CRITERIA.task2).toHaveLength(4);
  });

  it('links every type to a bundled model essay that follows its opening lines', () => {
    for (const t of [...TEMPLATES.task1, ...TEMPLATES.task2])
      for (const id of t.modelPresetIds) {
        const topic = [...task1, ...task2].find((x) => x.presetId === id);
        expect(topic, `${t.name} ${id}`).toBeDefined();
        const essay = parseMarkedText(topic!.text).tokens.join(' ');
        // 各段落の最初の行の決まった言い回しの最初の2語がエッセイに出てくる(The diagram と The diagrams の違いは許す)
        for (const p of t.paragraphs) {
          const fixed = splitTemplateLine(p.lines[0]!)[0]!;
          if (fixed.slot) continue;
          const words = fixed.text.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
          if (words) expect(essay.replace(/ , /g, ' ').replace(/ ,/g, ''), `${t.name} ${id} ${p.label}`).toContain(words);
        }
      }
  });

  it('files every Task 1 model essay under exactly one type', () => {
    const ids = TEMPLATES.task1.flatMap((t) => t.modelPresetIds);
    expect([...ids].sort()).toEqual(task1.map((t) => t.presetId).sort());
  });

  it('marks the parts to fill in', () => {
    expect(splitTemplateLine('Overall, while (A) 〜.')).toEqual([
      { text: 'Overall, while ', slot: false },
      { text: '(A)', slot: true },
      { text: ' ', slot: false },
      { text: '〜', slot: true },
      { text: '.', slot: false },
    ]);
  });

  it('gives every full model essay four paragraphs and a typed question', () => {
    const prompts = parseTaskPrompts(task2ModelPromptsRaw, TASK2_MODEL_PREFIX);
    for (const t of task2) {
      expect(paragraphs(t.text), t.title).toHaveLength(4);
      expect(t.text.startsWith('It is often argued that'), t.title).toBe(true);
      expect(prompts.get(t.presetId)?.headers[0], t.title).toMatch(/^Type: /);
    }
  });
});

describe('collocations', () => {
  it('bundles 20 topics of 10 marked sentences', () => {
    const topics = parsePresetTopics(collocationRaw, 'colloc-');
    expect(topics).toHaveLength(20);
    for (const t of topics) {
      expect(paragraphs(t.text), t.title).toHaveLength(10);
      for (const p of paragraphs(t.text)) expect(parseMarkedText(p).ranges.length, p).toBeGreaterThan(0);
    }
  });
});

describe('speaking', () => {
  const topics = parsePresetTopics(speakingRaw, SPEAKING_PREFIX);
  const prompts = parseTaskPrompts(speakingPromptsRaw, SPEAKING_PREFIX);

  it('bundles eight sets each of Part 1, 2 and 3 with their questions', () => {
    expect(topics.map((t) => t.title.split('｜')[0]!.replace(/^\d+\. /, ''))).toEqual([
      ...Array(4).fill('Part 1'),
      ...Array(4).fill('Part 2'),
      ...Array(4).fill('Part 3'),
      ...Array(4).fill('Part 1'),
      ...Array(4).fill('Part 2'),
      ...Array(4).fill('Part 3'),
    ]);
    for (const t of topics) expect(prompts.get(t.presetId), t.title).toBeDefined();
  });

  it('answers each Part 1 and Part 3 question in its own paragraph', () => {
    for (const t of topics) {
      if (t.title.includes('Part 2')) continue;
      expect(paragraphs(t.text), t.title).toHaveLength(prompts.get(t.presetId)!.requirements.length);
    }
  });
});
