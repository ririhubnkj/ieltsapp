import { describe, expect, it } from 'vitest';
import { lineBreaks, parseMarkedText, parsePresetTopics, presetEntriesToAdd, presetEntriesToRefresh, TASK1_PREFIX } from './presets';
import {
  getChunkTopics,
  getIdiomaticTopics,
  getPresetTopics,
  getTask1Figure,
  getTask1Topics,
  getTask2Prompt,
  getTaskPrompt,
  getTaskPromptChoices,
  getToeflPrompt,
  getToeflTopics,
  skipsTemplates,
} from './presetLibrary';
import type { Entry } from '../types';
import band6Task1Raw from '../data/band6/task1Topics.txt?raw';
import band6Task2Raw from '../data/band6/task2Topics.txt?raw';

const band6Figures = import.meta.glob<string>('../data/band6/task1Figures/*.svg', { query: '?raw', import: 'default', eager: true });

describe('parsePresetTopics', () => {
  it('splits headings and bodies', () => {
    const topics = parsePresetTopics('**1. First**\n\nHello world.\n\nSecond para.\n\n**2. Next Topic**\nBye.\n');
    expect(topics).toEqual([
      { presetId: 'topic-1', title: '1. First', text: 'Hello world.\n\nSecond para.' },
      { presetId: 'topic-2', title: '2. Next Topic', text: 'Bye.' },
    ]);
  });

  it('bundles all 29 topics', () => {
    const topics = getPresetTopics();
    expect(topics).toHaveLength(29);
    expect(topics[0]!.title).toBe('1. Higher Education vs. Vocational Training');
    expect(topics[28]!.title).toBe('29. Pressure on Young People to Succeed');
    // 両論＋意見・賛成反対・メリットデメリットの3つの型のどれかで始まる
    const openers = ['Some might claim that', 'Admittedly, some people argue that', 'One major advantage of'];
    expect(topics.every((t) => openers.some((o) => t.text.startsWith(o)))).toBe(true);
    expect(openers.map((o) => topics.filter((t) => t.text.startsWith(o)).length)).toEqual([10, 9, 10]);
  });

  it('marks idiomatic expressions in every topic, with balanced braces', () => {
    for (const t of getPresetTopics()) {
      expect(t.text.split('{{').length).toBe(t.text.split('}}').length);
      const { tokens, ranges } = parseMarkedText(t.text);
      expect(ranges.length).toBeGreaterThan(0);
      expect(tokens.some((tok) => tok.includes('{') || tok.includes('}'))).toBe(false);
    }
  });
});

describe('Task 1 topics', () => {
  it('bundles 12 model answers, two for each chart type, each with a figure', () => {
    const topics = getTask1Topics();
    expect(topics).toHaveLength(12);
    expect(topics.every((t) => t.presetId.startsWith('task1-'))).toBe(true);
    expect(topics.every((t) => t.text.includes('Overall, it is clear that'))).toBe(true);
    expect(topics.every((t) => getTask1Figure(t.presetId)?.startsWith('<svg'))).toBe(true);
  });

  it('keeps numbers out of the overview paragraph', () => {
    for (const t of getTask1Topics()) {
      const overview = t.text.split(/\n\s*\n/)[1]!;
      expect(overview.startsWith('Overall'), t.title).toBe(true);
      expect(/\d/.test(overview), t.title).toBe(false);
    }
  });

  it('follows the Looking first at / Turning to paragraphs', () => {
    for (const t of getTask1Topics()) {
      const paras = t.text.split(/\n\s*\n/);
      expect(paras, t.title).toHaveLength(4);
      expect(paras[2]!.startsWith('Looking first at'), t.title).toBe(true);
      expect(paras[3]!.startsWith('Turning to'), t.title).toBe(true);
    }
  });

  it('adds Task 1 topics into the given tab', () => {
    const { entries } = presetEntriesToAdd(getTask1Topics(), [], new Date(), 'ielts-task1');
    expect(entries.every((e) => e.deckId === 'ielts-task1')).toBe(true);
  });
});

describe('parseMarkedText', () => {
  it('drops the braces and marks each word inside them', () => {
    const { tokens, ranges } = parseMarkedText('It {{goes without saying}}, {{in theory}}.');
    expect(tokens).toEqual(['It', 'goes', 'without', 'saying', ',', 'in', 'theory', '.']);
    expect(ranges).toEqual([
      { start: 1, end: 1 },
      { start: 2, end: 2 },
      { start: 3, end: 3 },
      { start: 5, end: 5 },
      { start: 6, end: 6 },
    ]);
  });

  it('does not mark punctuation inside the braces', () => {
    const { ranges } = parseMarkedText('{{difficult, if not impossible}}');
    expect(ranges.map((r) => r.start)).toEqual([0, 2, 3, 4]);
  });
});

describe('presetEntriesToAdd', () => {
  it('skips topics that were already added', () => {
    const topics = parsePresetTopics('**1. A**\nOne.\n**2. B**\nTwo {{words}}.\n');
    const existing: Entry[] = [{ id: 'x', createdAt: '', tokens: [], presetId: 'topic-1' }];
    const { entries, markings } = presetEntriesToAdd(topics, existing);
    expect(entries.map((e) => e.presetId)).toEqual(['topic-2']);
    expect(entries[0]!.tokens).toEqual(['Two', 'words', '.']);
    expect(markings).toEqual([{ entryId: entries[0]!.id, ranges: [{ start: 1, end: 1 }] }]);
  });
});

describe('lineBreaks', () => {
  it('marks paragraph breaks and plain line breaks, but not the end of the text', () => {
    expect(lineBreaks('One {{two}}.\n\nThree four.\nFive.')).toEqual(
      new Map([
        [2, true],
        [5, false],
      ]),
    );
  });

  it('finds the four Task 1 paragraphs', () => {
    for (const t of getTask1Topics()) {
      expect([...lineBreaks(t.text).values()], t.title).toEqual([true, true, true]);
    }
  });
});

describe('TOEFL email topics', () => {
  it('bundles 10 emails, each with a prompt of three requirements', () => {
    const topics = getToeflTopics();
    expect(topics).toHaveLength(10);
    for (const t of topics) {
      const prompt = getToeflPrompt(t.presetId);
      expect(prompt?.requirements, t.title).toHaveLength(3);
      expect(prompt?.headers[0], t.title).toMatch(/^To:/);
    }
  });

  it('follows the email template from greeting to sign-off', () => {
    for (const t of getToeflTopics()) {
      expect(t.text, t.title).toMatch(/^Dear .+,\n\nHello, I hope you are doing well\. I am writing /);
      expect(t.text.endsWith('Best regards,\nMisaki'), t.title).toBe(true);
    }
  });
});

/** 代名詞は、イディオムの中にあっても穴にしない(give them an edge in の them など) */
const PRONOUNS = new Set(
  'i me my mine myself you your yours yourself he him his himself she her hers herself it its itself we us our ours ourselves they them their theirs themselves someone something'.split(' '),
);

function markedWords(text: string): string[] {
  const { tokens, ranges } = parseMarkedText(text);
  return ranges.map((r) => tokens[r.start]!.toLowerCase());
}

describe('Chunk topics', () => {
  it('bundles 21 days of 17 blocks each, so one lap takes three weeks', () => {
    const topics = getChunkTopics();
    expect(topics).toHaveLength(21);
    topics.forEach((t, i) => {
      expect(t.title).toBe(`${i + 1}. Day ${i + 1}`);
      expect(t.text.split(/\n\s*\n/), t.title).toHaveLength(17);
    });
  });

  it('never marks a pronoun', () => {
    for (const t of getChunkTopics()) expect(markedWords(t.text).filter((w) => PRONOUNS.has(w)), t.title).toEqual([]);
  });
});

describe('Idiomatic 300 topics', () => {
  it('bundles 30 days of 10 sentences each', () => {
    const topics = getIdiomaticTopics();
    expect(topics).toHaveLength(30);
    for (const t of topics) expect(t.text.split(/\n\s*\n/), t.title).toHaveLength(10);
  });

  it('never marks a pronoun', () => {
    for (const t of getIdiomaticTopics()) expect(markedWords(t.text).filter((w) => PRONOUNS.has(w)), t.title).toEqual([]);
  });

  it('keeps For instance and the numbers blankable, unlike the essay templates', () => {
    const [entry] = presetEntriesToAdd(getIdiomaticTopics().slice(0, 1), []).entries;
    expect(skipsTemplates(entry!)).toBe(false);
    const [essay] = presetEntriesToAdd(getPresetTopics().slice(0, 1), []).entries;
    expect(skipsTemplates(essay!)).toBe(true);
  });
});

describe('TOEFL prompts to pick on the client build', () => {
  it('offers the 10 emails and 10 academic discussions', () => {
    const [emails, discussions] = getTaskPromptChoices();
    expect(emails?.options).toHaveLength(10);
    expect(discussions?.options).toHaveLength(10);
    for (const o of [...emails!.options, ...discussions!.options]) {
      expect(o.label, o.id).toMatch(/^(Email|Discussion) \d+: \S/);
      expect(getTaskPrompt(o.id), o.id).not.toBeNull();
    }
  });

  it('gives each discussion a professor post, two student posts and two requirements', () => {
    for (const o of getTaskPromptChoices()[1]!.options) {
      const prompt = getTaskPrompt(o.id)!;
      expect(prompt.posts, o.id).toHaveLength(3);
      expect(prompt.posts[0]!.name, o.id).toMatch(/^(Prof|Dr)\. /);
      expect(prompt.requirements, o.id).toHaveLength(2);
      expect(prompt.paragraphs, o.id).toHaveLength(1);
    }
  });

  it('keeps the email prompts the same as the built-in TOEFL topics', () => {
    expect(getTaskPrompt('toefl-1')).toBe(getToeflPrompt('toefl-1'));
    expect(getTaskPrompt('toefl-1')?.posts).toEqual([]);
  });
});

describe('band 6 model answers for the everyone build', () => {
  const task1 = parsePresetTopics(band6Task1Raw, TASK1_PREFIX);
  const task2 = parsePresetTopics(band6Task2Raw);

  it('rewrites the same topics under the same titles', () => {
    expect(task2.map((t) => t.title)).toEqual(getPresetTopics().map((t) => t.title));
  });

  it('keeps the same Task 1 chart types, with its own figures', () => {
    const chartType = (title: string) => title.split('｜')[0];
    expect(task1.map((t) => chartType(t.title))).toEqual(getTask1Topics().map((t) => chartType(t.title)));
    for (const t of task1) {
      const figure = band6Figures[`../data/band6/task1Figures/${t.presetId.slice(TASK1_PREFIX.length)}.svg`];
      expect(figure?.startsWith('<svg'), t.title).toBe(true);
      expect(figure, t.title).not.toBe(getTask1Figure(t.presetId));
    }
  });

  it('keeps the Task 1 template and the number-free overview', () => {
    for (const t of task1) {
      const paras = t.text.split(/\n\s*\n/);
      expect(paras, t.title).toHaveLength(4);
      expect(paras[1]!.startsWith('Overall, it is clear that'), t.title).toBe(true);
      expect(/\d/.test(paras[1]!), t.title).toBe(false);
      expect(paras[2]!.startsWith('Looking first at'), t.title).toBe(true);
      expect(paras[3]!.startsWith('Turning to'), t.title).toBe(true);
    }
  });

  it('keeps the Task 2 template', () => {
    for (const t of task2) {
      expect(t.text, t.title).toMatch(/^Some might claim that .+ A good example of this can be observed in Japan/s);
      expect(t.text, t.title).toMatch(/\n\nHowever, (others assert that|opponents) .+ Firstly, .+ For instance, .+ Secondly, /s);
    }
  });
});

describe('presetEntriesToRefresh', () => {
  it('replaces only entries whose preset text changed and resets index-based settings', () => {
    const topics = [
      { presetId: 'topic-1', title: '1. A', text: 'One major advantage of {{it}} is speed.' },
      { presetId: 'topic-2', title: '2. B', text: 'Same text.' },
    ];
    const old = { id: 'a', createdAt: '', tokens: ['Old', 'text', '.'], presetId: 'topic-1', pinned: [0], excluded: [1] };
    const same = { id: 'b', createdAt: '', tokens: parseMarkedText('Same text.').tokens, presetId: 'topic-2' };
    const { entries, markings } = presetEntriesToRefresh(topics, [old, same]);
    expect(entries.map((e) => e.id)).toEqual(['a']);
    expect(entries[0]!.tokens).toEqual(parseMarkedText(topics[0]!.text).tokens);
    expect(entries[0]!.pinned).toBeUndefined();
    expect(entries[0]!.excluded).toBeUndefined();
    expect(markings).toEqual([{ entryId: 'a', ranges: parseMarkedText(topics[0]!.text).ranges }]);
  });
});

describe('IELTS Task 2 prompts', () => {
  it('gives every built-in essay a question whose type matches the opener', () => {
    const typeOf: Record<string, string> = {
      'Some might claim that': 'Type: Discuss both views',
      'Admittedly, some people argue that': 'Type: Agree or disagree',
      'One major advantage of': 'Type: Advantages and disadvantages',
    };
    for (const t of getPresetTopics()) {
      const prompt = getTask2Prompt(t.presetId);
      const opener = Object.keys(typeOf).find((o) => t.text.startsWith(o))!;
      expect(prompt?.headers).toEqual([typeOf[opener]]);
      expect(prompt?.paragraphs).toHaveLength(2);
    }
  });
});
