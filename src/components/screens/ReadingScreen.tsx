import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  allQuestions,
  estimatedBand,
  getPassage,
  saveResult,
  score,
  totalMarks,
  type ReadingPassage,
} from '../../lib/reading';
import { TopBar } from '../common/TopBar';
import { BackButton } from '../common/BackButton';
import { EmptyState } from '../common/EmptyState';
import { GroupBlock } from '../reading/QuestionBlocks';

type View = 'passage' | 'questions';

export function ReadingScreen() {
  const { id } = useParams<{ id: string }>();
  const passage = getPassage(id);
  if (!passage) {
    return (
      <div className="app-shell">
        <TopBar title="Reading" left={<BackButton to="/" />} />
        <EmptyState message="この演習は見つかりませんでした" />
      </div>
    );
  }
  return <ReadingPractice key={passage.id} passage={passage} />;
}

function ReadingPractice({ passage }: { passage: ReadingPassage }) {
  const [view, setView] = useState<View>('passage');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [elapsed, resetElapsed] = useElapsedSeconds(!submitted);
  const bodyRef = useRef<HTMLDivElement>(null);

  const questions = allQuestions(passage);
  const answered = questions.filter((q) => answers[q.num]?.trim()).length;
  const total = totalMarks(passage);
  const correct = score(passage, answers);
  const band = estimatedBand(correct, total);
  const limit = passage.minutes * 60;

  const setAnswer = (num: number, value: string) => setAnswers((a) => ({ ...a, [num]: value }));

  const switchView = (next: View) => {
    setView(next);
    bodyRef.current?.scrollTo({ top: 0 });
  };

  const submit = () => {
    saveResult(passage.id, score(passage, answers), total);
    setSubmitted(true);
    setConfirming(false);
    switchView('questions');
  };

  const retry = () => {
    setAnswers({});
    setSubmitted(false);
    setHighlight(null);
    resetElapsed();
    switchView('passage');
  };

  // 解説から根拠の段落へ飛ぶ
  const showEvidence = (label: string) => {
    setHighlight(label);
    setView('passage');
    requestAnimationFrame(() =>
      document.getElementById(`para-${label}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    );
  };

  return (
    <div className="app-shell app-shell--viewport">
      <TopBar
        title={passage.title}
        left={<BackButton to="/" />}
        right={
          <span
            style={{
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              color: !submitted && elapsed > limit ? 'var(--danger)' : 'var(--text-muted)',
            }}
            aria-label="経過時間"
          >
            {formatTime(elapsed)} / {passage.minutes}:00
          </span>
        }
      />

      <div role="tablist" style={{ display: 'flex', gap: 6, padding: '0 20px 10px', flexShrink: 0 }}>
        {(['passage', 'questions'] as View[]).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              role="tab"
              aria-selected={active}
              onClick={() => switchView(v)}
              style={{
                flex: 1,
                border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--text-muted)',
                borderRadius: 999,
                padding: '7px 0',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {v === 'passage' ? '本文' : submitted ? `結果 ${correct}/${total}` : `設問 ${answered}/${questions.length}`}
            </button>
          );
        })}
      </div>

      <div className="screen-body" ref={bodyRef}>
        {view === 'passage' ? (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{passage.titleJa}</div>
            {passage.paragraphs.map((p) => (
              <div
                key={p.label}
                id={`para-${p.label}`}
                style={{
                  display: 'flex',
                  gap: 10,
                  borderRadius: 10,
                  padding: highlight === p.label ? '8px 10px' : 0,
                  margin: highlight === p.label ? '-8px -10px' : 0,
                  background: highlight === p.label ? 'var(--pin-soft)' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--accent)', width: 14, flexShrink: 0 }}>{p.label}</div>
                <p style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.7 }}>{p.text}</p>
              </div>
            ))}
            {submitted && passage.vocab.length > 0 && (
              <div className="card">
                <div className="section-label">本文の重要語句</div>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 13.5 }}>
                  {passage.vocab.map((v) => (
                    <VocabRow key={v.en} en={v.en} ja={v.ja} />
                  ))}
                </dl>
              </div>
            )}
            {!submitted && (
              <button className="primary-btn" onClick={() => switchView('questions')}>
                設問へ進む
              </button>
            )}
          </>
        ) : (
          <>
            {submitted && (
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {correct}
                  <span style={{ fontSize: 15, color: 'var(--text-muted)' }}> / {total}</span>
                </div>
                <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {band !== null && (
                    <div>
                      バンドの目安 <b style={{ color: 'var(--text)' }}>{band.toFixed(1)}</b>(40問に換算)
                    </div>
                  )}
                  <div>かかった時間 {formatTime(elapsed)}</div>
                </div>
              </div>
            )}
            {passage.groups.map((group) => (
              <GroupBlock
                key={group.questions[0]!.num}
                passage={passage}
                group={group}
                answers={answers}
                submitted={submitted}
                onAnswer={setAnswer}
                onShowEvidence={showEvidence}
              />
            ))}
            {submitted ? (
              <button className="secondary-btn" onClick={retry}>
                もう一度解く
              </button>
            ) : confirming ? (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                <div>未回答が {questions.length - answered}問あります。このまま採点しますか?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="secondary-btn" style={{ flex: 1, padding: 10 }} onClick={() => setConfirming(false)}>
                    戻る
                  </button>
                  <button className="primary-btn" style={{ flex: 1, padding: 10 }} onClick={submit}>
                    採点する
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="primary-btn"
                onClick={() => (answered < questions.length ? setConfirming(true) : submit())}
              >
                採点する
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VocabRow({ en, ja }: { en: string; ja: string }) {
  return (
    <>
      <dt style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}>{en}</dt>
      <dd style={{ margin: 0, color: 'var(--text-muted)' }}>{ja}</dd>
    </>
  );
}

/** 開いてからの経過秒数(止めている間は進めない) */
function useElapsedSeconds(running: boolean): [number, () => void] {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return [seconds, () => setSeconds(0)];
}

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
