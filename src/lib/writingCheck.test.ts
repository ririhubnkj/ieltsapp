import { describe, expect, it } from 'vitest';
import {
  buildAiPrompt,
  checkEssay,
  contractions,
  countWords,
  firstPersonCount,
  firstSentence,
  hasOpening,
  isMonotonous,
  linkingWordsUsed,
  normalize,
  openingLabel,
  openingPattern,
  repeatedWords,
  splitParagraphs,
  splitSentences,
  task1QuestionFromEssay,
  task1TemplateId,
  task2TemplateId,
  type CheckItem,
} from './writingCheck';
import { TEMPLATES } from './writingTemplates';

const template = (task: 'task1' | 'task2', id: string) => TEMPLATES[task].find((t) => t.id === id)!;
const item = (items: CheckItem[], prefix: string) => items.find((i) => i.label.startsWith(prefix))!;

const TASK1_ESSAY = [
  'The line graph shows the annual income of three bakeries between 2010 and 2020.',
  'Overall, it is clear that while Bakery A grew strongly, Bakery C declined. Meanwhile, Bakery B stayed stable.',
  'Looking first at Bakery A, its income rose from 20,000 to 45,000 dollars. Similarly, it peaked at 50,000 in 2018.',
  'Turning to Bakery C, the figure fell to 12.5 thousand. In contrast, Bakery B remained at about 30,000.',
].join('\n\n');

const TASK2_ESSAY = [
  'It is often argued that fast food should be taxed heavily. From my perspective, I strongly agree with this proposal. This essay will discuss why I hold this viewpoint.',
  'Some might claim that taxes are unfair because poor families eat cheap meals. A good example of this can be observed in Japan, where lunch is expensive.',
  'However, I assert that health is more important. Firstly, obesity costs a great deal. For instance, hospitals spend billions every year. Secondly, prices change habits.',
  'In conclusion, I firmly believe that a tax is necessary. Overall, although some people might have opposing views, the benefits should not be overlooked.',
].join('\n');

describe('countWords / splitParagraphs / splitSentences', () => {
  it('counts numbers with decimals and commas as one word', () => {
    expect(countWords('It rose to 8.4 and 1,550 people.')).toBe(6);
    expect(countWords('')).toBe(0);
  });

  it('splits paragraphs on any line break and ignores blank lines', () => {
    expect(splitParagraphs('A.\n\n\nB.\nC.  \n ')).toEqual(['A.', 'B.', 'C.']);
  });

  it('does not split sentences inside decimals', () => {
    expect(splitSentences('It was 8.4 in 2010. Then it fell! Why? Nobody knows')).toEqual([
      'It was 8.4 in 2010.',
      'Then it fell!',
      'Why?',
      'Nobody knows',
    ]);
  });
});

describe('opening phrases', () => {
  it('takes the first three fixed words, with gaps for slots', () => {
    expect(openingPattern('It is often argued that 問題文パラフレーズ.')).toEqual(['it', 'is', 'often']);
    expect(openingPattern('The (graph の種類) shows 問題文パラフレーズ.')).toEqual(['the', null, 'shows']);
    expect(openingPattern('Turning to (グループB), 〜.')).toEqual(['turning', 'to']);
    expect(openingLabel(['the', null, 'shows'])).toBe('The 〜 shows');
  });

  it('matches case- and punctuation-insensitively, with any words in the gaps', () => {
    const essay = normalize('THE LINE GRAPH SHOWS the data. Overall, it is clear.');
    expect(hasOpening(essay, ['the', null, 'shows'])).toBe(true);
    expect(hasOpening(essay, ['overall', 'it', 'is'])).toBe(true);
    expect(hasOpening(essay, ['turning', 'to'])).toBe(false);
    // 単語の途中では一致しない
    expect(hasOpening(normalize('Overturning tower'), ['turning', 'to'])).toBe(false);
  });
});

describe('word-level helpers', () => {
  it('finds content words used five times or more', () => {
    const text = 'People like cars. People buy cars. People sell cars. People fix cars. People drive cars. The the the the the.';
    expect(repeatedWords(text)).toEqual([
      { word: 'cars', count: 5 },
      { word: 'people', count: 5 },
    ]);
  });

  it('lists linking words in order of appearance without duplicates', () => {
    expect(linkingWordsUsed('Firstly, it rose. However, it fell. However, for instance, it rose again.')).toEqual([
      'firstly',
      'however',
      'for instance',
    ]);
    expect(linkingWordsUsed('Thehowever is not a word.')).toEqual([]);
  });

  it('detects contractions but not possessives', () => {
    expect(contractions("We don't know. It’s late. Brookside's score can't fall. I'm sure.")).toEqual([
      "don't",
      "it's",
      "can't",
      "i'm",
    ]);
  });

  it('counts first-person words', () => {
    expect(firstPersonCount('I think my data shows that we grew. In the graph it is clear.')).toBe(3);
  });

  it('judges sentence-length variety', () => {
    expect(isMonotonous([12, 13, 14, 12, 15])).toBe(true);
    expect(isMonotonous([6, 14, 25, 10, 30])).toBe(false);
    expect(isMonotonous([12, 12, 12])).toBe(false);
  });
});

describe('checkEssay', () => {
  it('passes a well-formed Task 1 essay', () => {
    const items = checkEssay({ task: 'task1', text: TASK1_ESSAY, template: template('task1', 'trend') });
    expect(item(items, '語数').ok).toBe(false); // 短い例文なので語数だけ足りない
    expect(item(items, '段落').ok).toBe(true);
    expect(item(items, '型の書き出し').ok).toBe(true);
    expect(item(items, 'Overview').ok).toBe(true);
    expect(item(items, '第3・4段落の数字').ok).toBe(true);
    expect(item(items, '接続表現').ok).toBe(true);
    expect(item(items, '短縮形').ok).toBe(true);
    expect(item(items, '一人称').ok).toBe(true);
    expect(items.some((i) => i.label.startsWith('結論'))).toBe(false);
  });

  it('flags numbers in the Task 1 overview and missing details', () => {
    const text = 'The chart shows sales.\nOverall, sales rose to 50% in 2020.\nLooking first at A, it rose.\nTurning to B, I think it fell.';
    const items = checkEssay({ task: 'task1', text, template: template('task1', 'trend') });
    expect(item(items, 'Overview').ok).toBe(false);
    expect(item(items, '第3・4段落の数字').ok).toBe(false);
    expect(item(items, '一人称').ok).toBe(false);
    expect(item(items, '型の書き出し').detail).toContain('Overall it is');
  });

  it('checks position and conclusion for Task 2', () => {
    const items = checkEssay({ task: 'task2', text: TASK2_ESSAY, template: template('task2', 'agree-disagree') });
    expect(item(items, '自分の立場').ok).toBe(true);
    expect(item(items, '結論').ok).toBe(true);
    expect(item(items, '型の書き出し').ok).toBe(true);
    expect(item(items, '段落').ok).toBe(true);
    expect(items.some((i) => i.label.startsWith('一人称'))).toBe(false);
  });

  it('flags a missing position and a weak conclusion', () => {
    const text = 'It is often argued that X.\nSome say Y.\nOthers say Z.\nTo sum up, it depends.';
    const items = checkEssay({ task: 'task2', text, template: template('task2', 'both-views') });
    expect(item(items, '自分の立場').ok).toBe(false);
    expect(item(items, '結論').ok).toBe(false);
    expect(item(items, '段落').ok).toBe(true);
  });

  it('does not require a position for advantages and disadvantages', () => {
    const items = checkEssay({ task: 'task2', text: TASK2_ESSAY, template: template('task2', 'adv-disadv') });
    expect(items.some((i) => i.label.startsWith('自分の立場'))).toBe(false);
  });

  it('flags long sentences, contractions and too few linkers', () => {
    const long = Array.from({ length: 45 }, () => 'word').join(' ') + '.';
    const items = checkEssay({ task: 'task2', text: `${long}\nIt isn't good.` });
    expect(item(items, '長すぎる文').ok).toBe(false);
    expect(item(items, '短縮形').ok).toBe(false);
    expect(item(items, '接続表現').ok).toBe(false);
    expect(item(items, '同じ語').ok).toBe(false);
    expect(items.some((i) => i.label.startsWith('型の書き出し'))).toBe(false);
  });

  it('handles an empty essay', () => {
    const items = checkEssay({ task: 'task2', text: '' });
    expect(item(items, '語数').ok).toBe(false);
    expect(item(items, '文の長さ').ok).toBe(false);
  });
});

describe('question types', () => {
  it('maps the Task 2 Type: header to a template id', () => {
    expect(task2TemplateId(['Type: Advantages and disadvantages'])).toBe('adv-disadv');
    expect(task2TemplateId(['Type: Two-part question'])).toBe('two-part');
    expect(task2TemplateId(['Type: Problem and solution'])).toBe('problem-solution');
    expect(task2TemplateId(['Type: Discuss both views'])).toBe('both-views');
    expect(task2TemplateId(['Type: agree or disagree'])).toBe('agree-disagree');
    expect(task2TemplateId(['Type: Something else'])).toBeNull();
  });

  it('maps the Task 1 title to a template id', () => {
    expect(task1TemplateId('task1-1', '1. 表｜医療センターの評価')).toBe('compare');
    expect(task1TemplateId('task1-l2-5', '5. 棒｜旅行者の余暇の過ごし方')).toBe('compare');
    expect(task1TemplateId('task1-4', '4. 折れ線｜3つのベーカリーの年間収入')).toBe('trend');
    expect(task1TemplateId('task1-11', '11. 図解｜ハチミツができるまで')).toBe('process');
    expect(task1TemplateId('task1-l4-10', '10. 地図｜エルムフォードの町の変化')).toBe('map');
    expect(task1TemplateId('task1-15', '15. 円｜何か')).toBe('trend');
  });

  it('builds the Task 1 question from the first sentence', () => {
    const text = 'The line graph shows {{the average}} monthly change in prices.\n\nOverall, it is clear that 8.4 rose.';
    expect(firstSentence(text)).toBe('The line graph shows the average monthly change in prices.');
    expect(task1QuestionFromEssay(text)).toBe(
      'The line graph below shows the average monthly change in prices. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    );
    expect(task1QuestionFromEssay('The maps show the changes {{+to}} a town.')).toMatch(/^The maps below show the changes to a town\. Summarise/);
    expect(task1QuestionFromEssay('The diagram illustrates how honey is made.')).toMatch(/^The diagram below illustrates how/);
  });
});

describe('buildAiPrompt', () => {
  it('includes the role, question, band, criteria, essay and instructions', () => {
    const prompt = buildAiPrompt({
      task: 'task2',
      question: 'Fast food should be taxed. To what extent do you agree or disagree?',
      targetBand: '5.5–6.5',
      essay: TASK2_ESSAY,
      template: template('task2', 'agree-disagree'),
      seconds: 125,
    });
    expect(prompt).toContain('あなたは IELTS Writing の採点経験が豊富な試験官です');
    expect(prompt).toContain('Task 2');
    expect(prompt).toContain('Fast food should be taxed.');
    expect(prompt).toContain('5.5–6.5');
    for (const name of ['Task Response', 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy']) {
      expect(prompt).toContain(name);
    }
    expect(prompt).toContain('In conclusion, I firmly believe');
    expect(prompt).toContain('元の文 → 修正した文');
    expect(prompt).toContain('1つ上のバンド');
    expect(prompt).toContain('2分5秒');
  });

  it('describes the attached chart for Task 1', () => {
    const prompt = buildAiPrompt({
      task: 'task1',
      question: 'The line graph below shows X. Summarise …',
      chartDescription: 'The line graph shows X.',
      targetBand: '4.0–5.0',
      essay: TASK1_ESSAY,
    });
    expect(prompt).toContain('Task Achievement');
    expect(prompt).toContain('図表の画像は別に添付します');
    expect(prompt).toContain('図表の説明: The line graph shows X.');
  });
});
