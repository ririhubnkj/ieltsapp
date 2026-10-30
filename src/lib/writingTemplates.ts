/**
 * IELTS Writing の型(task1.pdf・task2.pdf)。段落ごとの書き出しと注意点、採点基準。
 * 各型のエッセイ例は内蔵の題材として入っていて、型の画面からそのまま穴埋めの練習に進める
 */

export interface TemplateParagraph {
  /** ➀〜➃ */
  label: string;
  /** 段落の書き出し。( ) や 〜 は自分で埋める部分 */
  lines: string[];
}

export interface WritingTemplate {
  id: string;
  /** 型の名前 */
  name: string;
  /** どんな問題に使うか(問題文の決まり文句やグラフの種類) */
  question: string;
  paragraphs: TemplateParagraph[];
  notes: string[];
  /** この型のエッセイ例(内蔵の題材の presetId) */
  modelPresetId: string;
}

export interface Criterion {
  name: string;
  nameJa: string;
  description: string;
}

export type WritingTask = 'task1' | 'task2';

const SHARED_CRITERIA: Criterion[] = [
  {
    name: 'Lexical Resource',
    nameJa: '語彙力',
    description:
      '使用する語彙の範囲や正確さ。適切なパラフレーズ(言い換え)、自然な単語の組み合わせ(コロケーション)、文脈に合わせた正確な単語の選択が求められる。',
  },
  {
    name: 'Grammatical Range and Accuracy',
    nameJa: '文法力と正確性',
    description:
      '多様な文法構造を正確に使えているか。時制や主語と動詞の一致などの文法ミス、スペルミスを少なく抑えることが重視される。',
  },
];

export const CRITERIA: Record<WritingTask, Criterion[]> = {
  task1: [
    {
      name: 'Task Achievement',
      nameJa: '課題の達成度',
      description:
        '図表の主な特徴を正しく読み取り、要約できているか。全体の傾向をまとめた Overview を必ず入れ、重要な数字を正確に取り上げて比較する。自分の意見は書かない。',
    },
    {
      name: 'Coherence and Cohesion',
      nameJa: '一貫性と論理的結合性',
      description:
        '情報が段落ごとに整理され、全体から詳細へと論理的に並んでいるか。接続詞や指示語などの接続表現が自然かつ効果的に使われているか。',
    },
    {
      ...SHARED_CRITERIA[0]!,
      description:
        '増減・比較・変化を表す語彙の範囲や正確さ。適切なパラフレーズ、自然なコロケーション、文脈に合わせた正確な単語の選択が求められる。',
    },
    SHARED_CRITERIA[1]!,
  ],
  task2: [
    {
      name: 'Task Response',
      nameJa: '課題への回答',
      description:
        '設問の指示にすべて正しく答え、一貫した主張を展開できているか。明確な立場を示し、適切な理由や具体例を挙げて論を展開する。',
    },
    {
      name: 'Coherence and Cohesion',
      nameJa: '一貫性と論理的結合性',
      description:
        '文章全体の構成や段落分けが適切で、主張や理由が論理的に整理されているか。接続詞や指示語などの接続表現が自然かつ効果的に使われているか。',
    },
    ...SHARED_CRITERIA,
  ],
};

export const TEMPLATES: Record<WritingTask, WritingTemplate[]> = {
  task1: [
    {
      id: 'trend',
      name: '時間の変化があるグラフ',
      question: 'Line graph / Bar chart / Table / Pie chart(年や月ごとの推移)',
      paragraphs: [
        { label: '➀', lines: ['The (graph の種類) shows 問題文パラフレーズ.'] },
        {
          label: '➁',
          lines: [
            'Overall, it is clear that while (大きく増えた項目) 〜, (大きく減った項目) 〜.',
            'Meanwhile, (変化の小さい項目) 〜.',
          ],
        },
        { label: '➂', lines: ['Looking first at (グループA), 〜 (数字を入れて詳しく).', 'Similarly / In contrast, 〜.'] },
        { label: '➃', lines: ['Turning to (グループB), 〜.', 'After that, 〜.'] },
      ],
      notes: [
        '➁の Overview には数字を入れず、全体の傾向だけを書く',
        'Overview は while で「増えたもの」と「減ったもの」など対照的な特徴を並べ、変化の小さいものは Meanwhile で付け足す',
        '➂➃では似た動きの項目をまとめ、始まり・終わり・最大値などの数字を入れて比べる',
        '全体で170語前後(160〜180語)を目安にする',
      ],
      modelPresetId: 'task1-4',
    },
    {
      id: 'compare',
      name: '比較のみのグラフ',
      question: '時間の変化がない Bar chart / Table / Pie chart',
      paragraphs: [
        { label: '➀', lines: ['The (graph の種類) shows 問題文パラフレーズ.'] },
        {
          label: '➁',
          lines: ['Overall, it is clear that while (最も大きい項目) 〜, (最も小さい項目) 〜.', 'Meanwhile, (目立つ特徴) 〜.'],
        },
        { label: '➂', lines: ['Looking first at (グループA), 〜 (数字を入れて詳しく).', 'On the other hand, 〜.'] },
        { label: '➃', lines: ['Turning to (グループB), 〜.'] },
      ],
      notes: [
        '時間の変化がないので、増減ではなく「最も多い・少ない」「同じくらい」で比べる',
        '➁の Overview には数字を入れず、最大・最小などの目立つ特徴だけを書く',
        '時制は図の年に合わせる(過去の年なら過去形)',
      ],
      modelPresetId: 'task1-5',
    },
    {
      id: 'map',
      name: '地図',
      question: 'Map(ある場所の過去と現在の比較)',
      paragraphs: [
        { label: '➀', lines: ['The maps show the changes 問題文パラフレーズ between (年) and (年 / now).'] },
        {
          label: '➁',
          lines: ['Overall, it is clear that while (大きく変わった点) 〜, (変わらなかった点) 〜.', 'Meanwhile, 〜.'],
        },
        { label: '➂', lines: ['Looking first at (エリアA), 〜 has been built / has been knocked down and replaced with 〜.'] },
        { label: '➃', lines: ['Turning to (エリアB), 〜 has been moved to 〜 / is still the same.', 'On the other hand, 〜.'] },
      ],
      notes: [
        '過去から現在までの変化は、現在完了の受け身(has been built など)で書く',
        '東西南北などの場所でエリアを2つに分け、➂➃で1つずつ説明する',
      ],
      modelPresetId: 'task1-9',
    },
    {
      id: 'process',
      name: 'プロセス・工程',
      question: 'Diagram(製造工程や自然の過程)',
      paragraphs: [
        { label: '➀', lines: ['The diagram shows how 問題文パラフレーズ.'] },
        {
          label: '➁',
          lines: [
            'Overall, it is clear that there are (数) main stages in this process, starting with 〜 and ending with 〜.',
            'Meanwhile, 〜.',
          ],
        },
        { label: '➂', lines: ['Looking first at the early stages, 〜.', 'After that, 〜.'] },
        { label: '➃', lines: ['Turning to the final stages, 〜.', 'As a result, 〜.'] },
      ],
      notes: [
        '➁の Overview に、段階の数と始まり・終わりを書く',
        '人の手による工程は受け身(is delivered, are added)、自然の過程は能動態で書く',
        'After that / Next / Finally などで順番をはっきりさせる',
      ],
      modelPresetId: 'task1-11',
    },
  ],
  task2: [
    {
      id: 'adv-disadv',
      name: 'メリット・デメリット比較',
      question: 'What are some of the advantages and disadvantages of this?',
      paragraphs: [
        {
          label: '➀',
          lines: [
            'It is often argued that 問題文パラフレーズ.',
            'From my perspective, this trend has both significant merits and drawbacks.',
            'This essay will discuss both sides of this issue.',
          ],
        },
        {
          label: '➁',
          lines: [
            'To begin with, one major advantage is 〜.',
            'A good example of this can be observed in Japan, where 〜.',
            'Additionally, 〜.',
          ],
        },
        {
          label: '➂',
          lines: [
            'Despite these benefits, there are significant drawbacks. One crucial downside is 〜. For instance, 〜.',
            'Moreover, 〜.',
          ],
        },
        {
          label: '➃',
          lines: [
            'In conclusion, although the topic presents several advantages such as (➁のまとめ), the disadvantages including (➂のまとめ) should not be overlooked.',
          ],
        },
      ],
      notes: [
        '自分の意見は問われないので、メリットとデメリットをフラットに書く',
        'メリット・デメリットをそれぞれ2つずつ書き、そのうちそれぞれ1つに具体例を付ける',
      ],
      modelPresetId: 'task2model-1',
    },
    {
      id: 'two-part',
      name: '2つ同時に質問',
      question: 'What are some reasons for this? What problem does this cause?',
      paragraphs: [
        {
          label: '➀',
          lines: [
            'It is often argued that 問題文パラフレーズ.',
            'This essay will discuss the reasons for this issue and provide my perspective on how to address it.',
          ],
        },
        {
          label: '➁',
          lines: [
            'To begin with, (質問Aへの回答).',
            'A good example of this can be observed in Japan, where 〜.',
            'Additionally, 〜.',
          ],
        },
        { label: '➂', lines: ['Turning to (質問Bへの回答).', 'Firstly, 〜. For instance, 〜.', 'Secondly, 〜.'] },
        {
          label: '➃',
          lines: ['In conclusion, I firmly believe that (質問Aのまとめ). Overall, I am convinced that (質問Bのまとめ).'],
        },
      ],
      notes: ['原因とそれが引き起こす問題を、それぞれ2つずつ書き、そのうちそれぞれ1つに具体例を付ける'],
      modelPresetId: 'task2model-2',
    },
    {
      id: 'problem-solution',
      name: '問題解決',
      question: 'Why does this happen? What can we do to solve it?',
      paragraphs: [
        {
          label: '➀',
          lines: [
            'It is often argued that 問題文パラフレーズ.',
            'This essay will discuss the underlying causes of this problem and propose some effective solutions.',
          ],
        },
        {
          label: '➁',
          lines: [
            'To begin with, one of the primary causes of this problem is 〜.',
            'A good example of this can be observed in Japan, where 〜.',
            'Another contributing factor is 〜.',
          ],
        },
        {
          label: '➂',
          lines: ['To address these issues, one effective measure could be 〜. For instance, 〜.', 'Secondly, 〜.'],
        },
        {
          label: '➃',
          lines: [
            'In conclusion, the problems resulting from (問題) are largely due to (原因のまとめ).',
            'If appropriate solutions such as (解決策のまとめ) are implemented, however, the situation can be significantly improved.',
          ],
        },
      ],
      notes: ['問題の原因と対処法を、それぞれ2つずつ書き、そのうちそれぞれ1つに具体例を付ける'],
      modelPresetId: 'task2model-3',
    },
    {
      id: 'both-views',
      name: '両方の意見 + 自分の意見',
      question: 'Discuss both these views and give your opinion.',
      paragraphs: [
        {
          label: '➀',
          lines: [
            'It is often argued that 問題文パラフレーズ.',
            'From my perspective, I strongly agree with the former / latter opinion.',
            'This essay will discuss both perspectives and why I hold this viewpoint.',
          ],
        },
        {
          label: '➁',
          lines: [
            'On the one hand, some might claim that (片方の意見) because 〜.',
            'A good example of this can be observed in Japan, where 〜.',
            'Additionally, 〜.',
          ],
        },
        {
          label: '➂',
          lines: [
            'On the other hand, opponents assert that (もう片方の意見) is more valid.',
            'Firstly, 〜. For instance, 〜.',
            'Secondly, 〜.',
          ],
        },
        {
          label: '➃',
          lines: [
            'In my opinion, although both sides present valid arguments, I personally believe that (自分の支持する意見 + 理由).',
            'While some might have opposing viewpoints, I am convinced that the importance of (自分の意見のまとめ) should not be overlooked.',
          ],
        },
      ],
      notes: [
        '両方の意見に理由を2つずつ書き、そのうちそれぞれ1つに具体例を付ける(➁➂ではどちらもフラットに)',
        '➃の結論で、自分がどちら側なのかを述べる',
      ],
      modelPresetId: 'task2model-4',
    },
    {
      id: 'agree-disagree',
      name: '賛成反対',
      question: 'To what extent do you agree or disagree?',
      paragraphs: [
        {
          label: '➀',
          lines: [
            'It is often argued that 問題文パラフレーズ.',
            'From my perspective, I strongly (agree / disagree) with this proposal.',
            'This essay will discuss why I hold this viewpoint.',
          ],
        },
        {
          label: '➁',
          lines: [
            'Some might claim that (反対意見) because 〜.',
            'A good example of this can be observed in Japan, where 〜.',
            'Additionally, 〜.',
          ],
        },
        {
          label: '➂',
          lines: [
            'However, I assert that (自分の意見).',
            'Firstly, 〜. For instance, 〜.',
            'Secondly, 〜. As can be seen in (国名), 〜.',
          ],
        },
        {
          label: '➃',
          lines: [
            'In conclusion, I firmly believe that (自分の意見).',
            'Overall, although some people might have opposing views, I am convinced that the importance of (自分の意見のまとめ) should not be overlooked.',
          ],
        },
      ],
      notes: [
        '➁ではあえて譲歩の意見を書くが、自分の意見(➂)の方が大事なので比重を➂に寄せる',
        '➁は理由2つ・具体例1つ、➂は理由2つにそれぞれ具体例を付ける',
      ],
      modelPresetId: 'task2model-5',
    },
  ],
};

/** 型の行を、決まった言い回しと自分で埋める部分((…)・〜・日本語)に分ける */
export function splitTemplateLine(line: string): { text: string; slot: boolean }[] {
  return line
    .split(/(\([^)]*\)|〜|問題文パラフレーズ)/)
    .filter(Boolean)
    .map((text) => ({ text, slot: /^\(.*\)$|^〜$|^問題文パラフレーズ$/.test(text) }));
}
