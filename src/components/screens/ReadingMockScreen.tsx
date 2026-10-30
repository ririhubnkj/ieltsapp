import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLevel } from '../../hooks/useLevel';
import { logActivity } from '../../lib/activity';
import { LEVELS, levelOfPassageId, getLevel } from '../../lib/levels';
import { loadResults, PASSAGES, passagesForLevel, saveResult, score, totalMarks, TYPE_LABEL, type ReadingPassage } from '../../lib/reading';
import {
  formatClock,
  loadMockHistory,
  mockBand,
  mockNumbers,
  mockScore,
  mockTotalMarks,
  MOCK_MINUTES,
  MOCK_PASSAGES,
  pickMockPassages,
  questionOffsets,
  saveMockRecord,
  sortByLevel,
  typeAccuracy,
} from '../../lib/readingMock';
import { TopBar } from '../common/TopBar';
import { BackButton } from '../common/BackButton';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BackIcon } from '../common/icons';
import { GroupBlock } from '../reading/QuestionBlocks';

type View = 'passage' | 'questions';
/** 結果のまとめのタブ(0〜2 は各 Passage) */
const SUMMARY = -1;

export function ReadingMockScreen() {
  const [session, setSession] = useState<{ passages: ReadingPassage[]; key: number } | null>(null);
  if (!session) return <StartView onStart={(passages) => setSession({ passages, key: Date.now() })} />;
  return <MockSession key={session.key} passages={session.passages} onExit={() => setSession(null)} />;
}

/* ---------- 始める前 ---------- */

function StartView({ onStart }: { onStart: (passages: ReadingPassage[]) => void }) {
  const { level } = useLevel();
  const [selected, setSelected] = useState<string[]>(() => pickMockPassages(level.id).map((p) => p.id));
  const [manual, setManual] = useState(false);
  const history = useMemo(() => loadMockHistory().slice(-5).reverse(), []);
  const results = useMemo(() => loadResults(), []);
  const chosen = sortByLevel(PASSAGES.filter((p) => selected.includes(p.id)));
  const ready = chosen.length === MOCK_PASSAGES;
  const questionCount = ready ? mockTotalMarks(chosen) : 39;

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MOCK_PASSAGES ? [...s, id] : s));

  return (
    <div className="app-shell">
      <TopBar title="Reading 模試" left={<BackButton to="/" />} />
      <div className="screen-body">
        <div className="card" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
          <div className="section-label">本番と同じ形で解く</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <li>本文を3題続けて解きます。設問は全部で{questionCount}問です(本番は40問)。</li>
            <li>制限時間は{MOCK_MINUTES}分です。始めたら時間は止められません。</li>
            <li>60分を過ぎても続けられますが、時間が赤で表示されます。</li>
            <li>最後にまとめて採点し、バンドの目安と1問ずつの解説を出します。</li>
          </ul>
        </div>

        <div className="card">
          <div className="section-label">出題する本文</div>
          {ready ? (
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chosen.map((p, i) => (
                <li key={p.id} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.5 }}>
                  <b style={{ color: 'var(--accent)', flexShrink: 0, width: 72 }}>Passage {i + 1}</b>
                  <span>
                    {p.title}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                      {p.titleJa} ・ {getLevel(levelOfPassageId(p.id)).name}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              あと{MOCK_PASSAGES - chosen.length}題選んでください(いま{chosen.length}題)
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              className="secondary-btn"
              style={{ flex: 1, padding: 10, fontSize: 13.5 }}
              onClick={() => setSelected(pickMockPassages(level.id).map((p) => p.id))}
            >
              選び直す
            </button>
            <button
              className="secondary-btn"
              style={{ flex: 1, padding: 10, fontSize: 13.5 }}
              aria-expanded={manual}
              onClick={() => setManual((m) => !m)}
            >
              {manual ? '一覧を閉じる' : '自分で選ぶ'}
            </button>
          </div>
        </div>

        {manual && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>ちょうど3題選んでください。</div>
            {LEVELS.map((l) => {
              const list = passagesForLevel(l.id);
              if (list.length === 0) return null;
              return (
                <div key={l.id}>
                  <div className="section-label" style={{ marginBottom: 6 }}>
                    {l.name}(バンド {l.band})
                  </div>
                  {list.map((p) => {
                    const checked = selected.includes(p.id);
                    const disabled = !checked && selected.length >= MOCK_PASSAGES;
                    const result = results[p.id];
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          padding: '6px 0',
                          fontSize: 14,
                          lineHeight: 1.45,
                          opacity: disabled ? 0.5 : 1,
                          cursor: disabled ? 'default' : 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(p.id)}
                          style={{ marginTop: 3, accentColor: 'var(--accent)' }}
                        />
                        <span>
                          {p.title}
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>
                            {p.titleJa}
                            {result && ` ・ 前回 ${result.last}/${result.total}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <button className="primary-btn" disabled={!ready} onClick={() => onStart(chosen)}>
          {MOCK_MINUTES}分の模試を始める
        </button>

        {history.length > 0 && (
          <div className="card">
            <div className="section-label">これまでの模試(最近5回)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13.5 }}>
              {history.map((h) => (
                <div key={h.at} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-muted)', width: 92, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {formatDate(h.at)}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {h.score} / {h.total}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    バンド <b style={{ color: 'var(--text)' }}>{h.band !== null ? h.band.toFixed(1) : '—'}</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- 解いている間と結果 ---------- */

function MockSession({ passages, onExit }: { passages: ReadingPassage[]; onExit: () => void }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const [answers, setAnswers] = useState<Record<number, string>[]>(() => passages.map(() => ({})));
  const [tab, setTab] = useState(0);
  const [views, setViews] = useState<View[]>(() => passages.map(() => 'passage'));
  const [highlights, setHighlights] = useState<(string | null)[]>(() => passages.map(() => null));
  const [usedSeconds, setUsedSeconds] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'leave' | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** タブを行き来しても読んでいた位置に戻れるように、タブと表示ごとのスクロール位置を覚えておく */
  const scrollPos = useRef<Record<string, number>>({});

  const submitted = usedSeconds !== null;
  const elapsed = usedSeconds ?? Math.max(0, Math.floor((now - startedAt) / 1000));
  const limit = MOCK_MINUTES * 60;
  const offsets = questionOffsets(passages);
  const numbers = mockNumbers(passages, answers);
  const unanswered = numbers.filter((n) => !n.answered).length;
  const total = mockTotalMarks(passages);
  const correct = mockScore(passages, answers);
  const view: View | null = tab === SUMMARY ? null : views[tab]!;

  // 時間は止めない(画面を離れていても、始めた時刻から数える)
  useEffect(() => {
    if (submitted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [submitted]);

  // 解いている途中でページを閉じようとしたら確かめる
  useEffect(() => {
    if (submitted) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [submitted]);

  const posKey = (t: number, v: View | null) => `${t}-${v ?? ''}`;

  /** タブ(と本文・設問)を切り替える。after を渡さなければ前に見ていた位置に戻す */
  const go = (nextTab: number, nextView?: View, after?: () => void) => {
    scrollPos.current[posKey(tab, view)] = bodyRef.current?.scrollTop ?? 0;
    const v = nextTab === SUMMARY ? null : (nextView ?? views[nextTab]!);
    setTab(nextTab);
    if (nextTab !== SUMMARY && nextView) setViews((vs) => vs.map((x, i) => (i === nextTab ? nextView : x)));
    requestAnimationFrame(() => {
      if (after) after();
      else bodyRef.current?.scrollTo({ top: scrollPos.current[posKey(nextTab, v)] ?? 0 });
    });
  };

  const setAnswer = (pi: number, num: number, value: string) =>
    setAnswers((all) => all.map((a, i) => (i === pi ? { ...a, [num]: value } : a)));

  const jumpTo = (pi: number, num: number) => {
    setSheetOpen(false);
    go(pi, 'questions', () => document.getElementById(`mock-${pi}-q${num}`)?.scrollIntoView({ block: 'start' }));
  };

  // 解説から根拠の段落へ飛ぶ
  const showEvidence = (pi: number, label: string) => {
    setHighlights((hs) => hs.map((h, i) => (i === pi ? label : h)));
    go(pi, 'passage', () =>
      document.getElementById(`mock-${pi}-para-${label}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    );
  };

  const submit = () => {
    const seconds = elapsed;
    passages.forEach((p, i) => saveResult(p.id, score(p, answers[i] ?? {}), totalMarks(p)));
    const band = mockBand(correct, total);
    logActivity({ kind: 'mock', title: 'Reading 模試', score: correct, total, band: band ?? undefined, seconds });
    saveMockRecord({ score: correct, total, band, passageIds: passages.map((p) => p.id) });
    setUsedSeconds(seconds);
    setConfirm(null);
    setSheetOpen(false);
    scrollPos.current = {};
    go(SUMMARY);
  };

  const requestSubmit = () => {
    setSheetOpen(false);
    if (unanswered > 0) setConfirm('submit');
    else submit();
  };

  const remaining = limit - elapsed;
  const over = remaining < 0;

  return (
    <div className="app-shell app-shell--viewport">
      <TopBar
        title={submitted ? '模試の結果' : 'Reading 模試'}
        left={
          <button className="icon-btn" aria-label="戻る" onClick={() => (submitted ? onExit() : setConfirm('leave'))}>
            <BackIcon />
          </button>
        }
        right={
          !submitted && (
            <span
              role="timer"
              aria-label={over ? '制限時間を過ぎた時間' : '残り時間'}
              style={{
                fontSize: 15,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: over ? 'var(--danger)' : 'var(--text)',
                background: over ? 'var(--danger-soft)' : 'var(--surface)',
                border: '1px solid ' + (over ? 'var(--danger)' : 'var(--border)'),
                borderRadius: 6,
                padding: '4px 10px',
              }}
            >
              {over ? `超過 ${formatClock(-remaining)}` : formatClock(remaining)}
            </span>
          )
        }
      />

      <div role="tablist" aria-label="Passage" style={{ display: 'flex', gap: 6, padding: '0 20px 8px', flexShrink: 0 }}>
        {submitted && (
          <TabButton active={tab === SUMMARY} onClick={() => go(SUMMARY)} label="結果" sub={`${correct}/${total}`} />
        )}
        {passages.map((p, pi) => {
          const nums = numbers.filter((n) => n.passageIndex === pi);
          const sub = submitted
            ? `${score(p, answers[pi] ?? {})}/${totalMarks(p)}`
            : `${nums.filter((n) => n.answered).length}/${nums.length}`;
          return <TabButton key={p.id} active={tab === pi} onClick={() => go(pi)} label={`Passage ${pi + 1}`} sub={sub} />;
        })}
      </div>

      {view && (
        <div style={{ display: 'flex', gap: 6, padding: '0 20px 10px', flexShrink: 0 }}>
          {(['passage', 'questions'] as View[]).map((v) => (
            <PillButton key={v} active={view === v} onClick={() => go(tab, v)}>
              {v === 'passage' ? '本文' : '設問'}
            </PillButton>
          ))}
          {!submitted && (
            <PillButton active={false} onClick={() => setSheetOpen(true)}>
              解答状況 {numbers.length - unanswered}/{numbers.length}
            </PillButton>
          )}
        </div>
      )}

      <div className="screen-body" ref={bodyRef}>
        {tab === SUMMARY ? (
          <Summary
            passages={passages}
            answers={answers}
            correct={correct}
            total={total}
            seconds={elapsed}
            onReview={(pi) => go(pi, 'questions', () => bodyRef.current?.scrollTo({ top: 0 }))}
            onAgain={onExit}
          />
        ) : view === 'passage' ? (
          <PassageText
            passage={passages[tab]!}
            index={tab}
            highlight={highlights[tab] ?? null}
            submitted={submitted}
            onNext={() => go(tab, 'questions')}
          />
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Passage {tab + 1} ・ Questions {offsets[tab]! + 1}–{offsets[tab]! + totalMarks(passages[tab]!)}
            </div>
            {passages[tab]!.groups.map((group) => (
              <GroupBlock
                key={group.questions[0]!.num}
                passage={passages[tab]!}
                group={group}
                answers={answers[tab] ?? {}}
                submitted={submitted}
                onAnswer={(num, value) => setAnswer(tab, num, value)}
                onShowEvidence={(label) => showEvidence(tab, label)}
                numberOffset={offsets[tab]}
                anchorPrefix={`mock-${tab}-q`}
              />
            ))}
            {tab < passages.length - 1 ? (
              <button
                className={submitted ? 'secondary-btn' : 'primary-btn'}
                onClick={() => go(tab + 1, submitted ? 'questions' : 'passage', () => bodyRef.current?.scrollTo({ top: 0 }))}
              >
                Passage {tab + 2} へ進む
              </button>
            ) : submitted ? (
              <button className="secondary-btn" onClick={() => go(SUMMARY)}>
                結果のまとめに戻る
              </button>
            ) : (
              <button className="primary-btn" onClick={requestSubmit}>
                提出して採点する
              </button>
            )}
          </>
        )}
      </div>

      {sheetOpen && (
        <AnswerSheet
          passages={passages}
          numbers={numbers}
          unanswered={unanswered}
          onJump={jumpTo}
          onSubmit={requestSubmit}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {confirm === 'submit' && (
        <ConfirmDialog
          title="提出しますか?"
          body={`未回答が${unanswered}問あります。提出すると答えは直せません。`}
          confirmLabel="提出する"
          onConfirm={submit}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'leave' && (
        <ConfirmDialog
          title="模試をやめますか?"
          body="ここまでの答えは採点されず、記録にも残りません。"
          confirmLabel="やめる"
          danger
          onConfirm={onExit}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        borderRadius: 6,
        padding: '5px 2px',
        fontSize: 12.5,
        fontWeight: 700,
        lineHeight: 1.3,
      }}
    >
      {label}
      <span style={{ display: 'block', fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{sub}</span>
    </button>
  );
}

/** 本文・設問の切り替え(ReadingScreen と同じ見た目) */
function PillButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-pressed={active}
      onClick={onClick}
      style={{
        flex: 1,
        border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
        background: active ? 'var(--accent)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text-muted)',
        borderRadius: 999,
        padding: '7px 0',
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

function PassageText({
  passage,
  index,
  highlight,
  submitted,
  onNext,
}: {
  passage: ReadingPassage;
  index: number;
  highlight: string | null;
  submitted: boolean;
  onNext: () => void;
}) {
  return (
    <>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-serif)' }}>{passage.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{passage.titleJa}</div>
      </div>
      {passage.paragraphs.map((p) => (
        <div
          key={p.label}
          id={`mock-${index}-para-${p.label}`}
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
              <div key={v.en} style={{ display: 'contents' }}>
                <dt style={{ fontFamily: 'var(--font-serif)', fontWeight: 500 }}>{v.en}</dt>
                <dd style={{ margin: 0, color: 'var(--text-muted)' }}>{v.ja}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <button className={submitted ? 'secondary-btn' : 'primary-btn'} onClick={onNext}>
        {submitted ? '設問と解説を見る' : '設問へ進む'}
      </button>
    </>
  );
}

function AnswerSheet({
  passages,
  numbers,
  unanswered,
  onJump,
  onSubmit,
  onClose,
}: {
  passages: ReadingPassage[];
  numbers: ReturnType<typeof mockNumbers>;
  unanswered: number;
  onJump: (passageIndex: number, num: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="解答状況"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,36,48,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 9,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '85dvh',
          overflow: 'auto',
          background: 'var(--surface)',
          borderRadius: '16px 16px 0 0',
          padding: '18px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>解答状況</div>
          <div style={{ fontSize: 13, color: unanswered > 0 ? 'var(--text-muted)' : 'var(--success)' }}>
            {unanswered > 0 ? `未回答 ${unanswered}問` : 'すべて回答済み'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ ...swatch, background: 'var(--accent)', borderColor: 'var(--accent)' }} />
            回答済み
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={swatch} />
            未回答
          </span>
          <span>番号を押すとその設問へ移ります</span>
        </div>
        {passages.map((p, pi) => (
          <div key={p.id}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
              Passage {pi + 1}
              <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-muted)' }}>{p.title}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: 6 }}>
              {numbers
                .filter((n) => n.passageIndex === pi)
                .map((n) => (
                  <button
                    key={n.display}
                    onClick={() => onJump(n.passageIndex, n.num)}
                    aria-label={`${n.display}(${n.answered ? '回答済み' : '未回答'})`}
                    style={{
                      height: 36,
                      borderRadius: 6,
                      border: '1.5px solid ' + (n.answered ? 'var(--accent)' : 'var(--border)'),
                      background: n.answered ? 'var(--accent)' : 'var(--bg)',
                      color: n.answered ? '#fff' : 'var(--text)',
                      fontSize: 13.5,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {n.display}
                  </button>
                ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary-btn" style={{ flex: 1, padding: 12 }} onClick={onClose}>
            閉じる
          </button>
          <button className="primary-btn" style={{ flex: 1, padding: 12 }} onClick={onSubmit}>
            提出して採点する
          </button>
        </div>
      </div>
    </div>
  );
}

const swatch: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 3,
  border: '1.5px solid var(--border)',
  background: 'var(--bg)',
  display: 'inline-block',
};

function Summary({
  passages,
  answers,
  correct,
  total,
  seconds,
  onReview,
  onAgain,
}: {
  passages: ReadingPassage[];
  answers: Record<number, string>[];
  correct: number;
  total: number;
  seconds: number;
  onReview: (passageIndex: number) => void;
  onAgain: () => void;
}) {
  const band = mockBand(correct, total);
  const limit = MOCK_MINUTES * 60;
  const types = typeAccuracy(passages, answers);
  return (
    <>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
          {correct}
          <span style={{ fontSize: 16, color: 'var(--text-muted)' }}> / {total}</span>
        </div>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          <div>
            バンドの目安 <b style={{ color: 'var(--text)', fontSize: 16 }}>{band !== null ? band.toFixed(1) : '—'}</b>
            (40問に換算)
          </div>
          <div>
            かかった時間{' '}
            <b style={{ color: seconds > limit ? 'var(--danger)' : 'var(--text)' }}>{formatClock(seconds)}</b> / {MOCK_MINUTES}:00
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-label">Passage ごとの得点</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {passages.map((p, pi) => (
            <button
              key={p.id}
              onClick={() => onReview(pi)}
              style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', color: 'var(--text)' }}
            >
              <ScoreRow
                label={
                  <>
                    <b>Passage {pi + 1}</b>
                    <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>{p.title}</span>
                  </>
                }
                marks={score(p, answers[pi] ?? {})}
                total={totalMarks(p)}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-label">設問の形式ごとの正答率</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {types.map((t) => (
            <ScoreRow key={t.type} label={TYPE_LABEL[t.type]} marks={t.marks} total={t.total} />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        上の Passage のタブで、1問ずつ正解と解説を確かめられます。解説から根拠の段落へ移れます。
      </div>
      <button className="primary-btn" onClick={() => onReview(0)}>
        Passage 1 から解説を見る
      </button>
      <button className="secondary-btn" onClick={onAgain}>
        別の組み合わせで模試を解く
      </button>
    </>
  );
}

function ScoreRow({ label, marks, total }: { label: ReactNode; marks: number; total: number }) {
  const pct = total > 0 ? Math.round((marks / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13.5 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
          {marks}/{total}
          <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--text-muted)' }}>{pct}%</span>
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--accent-soft)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? 'var(--success)' : 'var(--accent)' }} />
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
