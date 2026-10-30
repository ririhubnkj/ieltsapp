import {
  answerOptions,
  correctAnswerLabel,
  isCorrect,
  isWritten,
  marksFor,
  splitKeys,
  TYPE_LABEL,
  type QuestionGroup,
  type ReadingPassage,
  type ReadingQuestion,
} from '../../lib/reading';
import { displayLabel, renumberInstructions } from '../../lib/readingMock';

/**
 * 設問のまとまり(Questions 1–5 と指示文、選択肢の一覧、各設問)。
 * numberOffset は模試の通し番号用(2題目なら13を足して14から出す)。
 * anchorPrefix を渡すと、各設問のカードに id(anchorPrefix + 設問の番号)を付ける
 */
export function GroupBlock({
  passage,
  group,
  answers,
  submitted,
  onAnswer,
  onShowEvidence,
  numberOffset = 0,
  anchorPrefix,
}: {
  passage: ReadingPassage;
  group: QuestionGroup;
  answers: Record<number, string>;
  submitted: boolean;
  onAnswer: (num: number, value: string) => void;
  onShowEvidence: (label: string) => void;
  numberOffset?: number;
  anchorPrefix?: string;
}) {
  const first = group.questions[0]!.num + numberOffset;
  const lastQuestion = group.questions[group.questions.length - 1]!;
  const last = lastQuestion.num + (lastQuestion.count ?? 1) - 1 + numberOffset;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          Questions {first}–{last}
          <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)' }}>{TYPE_LABEL[group.type]}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.55, marginTop: 4 }}>
          {/* 見出しに番号を出すので、指示文の頭の Questions 1–5. は省く */}
          {renumberInstructions(group.instructions.replace(/^Questions\s+\d+\s*[–-]\s*\d+\.?\s*/, ''), numberOffset)}
        </div>
      </div>
      {group.options && (
        <div className="card" style={{ padding: '10px 14px', fontSize: 13.5, lineHeight: 1.55 }}>
          {group.options.map((o) => (
            <div key={o.key} style={{ display: 'flex', gap: 8 }}>
              <b style={{ minWidth: 14, flexShrink: 0 }}>{o.key}</b>
              <span>{o.text}</span>
            </div>
          ))}
        </div>
      )}
      {group.questions.map((q) => (
        <QuestionCard
          key={q.num}
          passage={passage}
          group={group}
          question={q}
          value={answers[q.num] ?? ''}
          submitted={submitted}
          onAnswer={(v) => onAnswer(q.num, v)}
          onShowEvidence={onShowEvidence}
          numberOffset={numberOffset}
          anchorId={anchorPrefix === undefined ? undefined : `${anchorPrefix}${q.num}`}
        />
      ))}
    </div>
  );
}

/** 1問分のカード(答える欄と、採点後の正誤・解説・根拠の段落へのリンク) */
export function QuestionCard({
  passage,
  group,
  question,
  value,
  submitted,
  onAnswer,
  onShowEvidence,
  numberOffset = 0,
  anchorId,
}: {
  passage: ReadingPassage;
  group: QuestionGroup;
  question: ReadingQuestion;
  value: string;
  submitted: boolean;
  onAnswer: (value: string) => void;
  onShowEvidence: (label: string) => void;
  numberOffset?: number;
  anchorId?: string;
}) {
  const options = answerOptions(passage, group, question);
  const ok = submitted && isCorrect(question, value);
  const count = question.count ?? 1;
  const multi = count > 1;
  const partial = submitted && !ok && marksFor(question, value) > 0;
  const border = !submitted ? 'var(--border)' : ok ? 'var(--success)' : partial ? 'var(--pin)' : 'var(--danger)';
  const selectedKeys = multi ? splitKeys(value) : [value];
  const label = displayLabel(question, numberOffset);
  // 2つ選ぶ問題は、選んだ記号を順に足し外しし、2つを超えたら古い方から外す
  const choose = (o: string) => {
    if (!multi) return onAnswer(value === o ? '' : o);
    const next = selectedKeys.includes(o) ? selectedKeys.filter((k) => k !== o) : [...selectedKeys, o].slice(-count);
    onAnswer(next.sort().join(','));
  };
  return (
    <div
      id={anchorId}
      className="card"
      style={{ borderColor: border, display: 'flex', flexDirection: 'column', gap: 10, scrollMarginTop: 12 }}
    >
      <div style={{ display: 'flex', gap: 8, fontSize: 14, lineHeight: 1.55 }}>
        <b style={{ flexShrink: 0 }}>{label}</b>
        <span>{question.text}</span>
      </div>
      {question.choices && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13.5, lineHeight: 1.5 }}>
          {question.choices.map((c) => (
            <div key={c.key} style={{ display: 'flex', gap: 8 }}>
              <b style={{ width: 14, flexShrink: 0 }}>{c.key}</b>
              <span>{c.text}</span>
            </div>
          ))}
        </div>
      )}
      {isWritten(group.type) ? (
        <input
          type="text"
          value={value}
          disabled={submitted}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder="答えを入力"
          aria-label={`${label}の答え`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 15,
            color: 'var(--text)',
          }}
        />
      ) : (
        <div role={multi ? 'group' : 'radiogroup'} aria-label={`${label}の答え`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {options.map((o) => {
            const selected = selectedKeys.includes(o);
            const isAnswer = submitted && splitKeys(question.answer).includes(o);
            return (
              <button
                key={o}
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={selected}
                disabled={submitted}
                onClick={() => choose(o)}
                style={{
                  minWidth: 40,
                  border: '1.5px solid ' + (isAnswer ? 'var(--success)' : selected ? 'var(--accent)' : 'var(--border)'),
                  background: isAnswer ? 'var(--success-soft)' : selected ? 'var(--accent-soft)' : 'var(--surface)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitted ? 'default' : 'pointer',
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}
      {submitted && (
        <div
          style={{
            background: ok ? 'var(--success-soft)' : 'var(--danger-soft)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {ok ? '正解' : `${partial ? '部分正解' : '不正解'}(あなたの答え: ${value.trim() || '未回答'})`} ・ 正解{' '}
            {correctAnswerLabel(question)}
          </div>
          <div style={{ marginTop: 4 }}>{question.explanation}</div>
          <button
            onClick={() => onShowEvidence(question.evidence)}
            style={{
              marginTop: 6,
              border: 'none',
              background: 'none',
              padding: 0,
              color: 'var(--accent)',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            本文の段落 {question.evidence} を見る →
          </button>
        </div>
      )}
    </div>
  );
}
