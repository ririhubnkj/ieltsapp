import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSpeakingPrompt, type TaskPrompt } from '../../lib/presetLibrary';
import { levelTopics } from '../../lib/levels';
import { speak, speechSupported, splitSentences } from '../../lib/speech';
import { logActivity } from '../../lib/activity';
import {
  ANSWER_SECONDS,
  basePresetId,
  examQuestions,
  examSteps,
  firstStepIndex,
  formatClock,
  groupByPart,
  listenFallbackMs,
  modelTopicFor,
  nextStepIndex,
  pickRandom,
  PREP_SECONDS,
  remainingSeconds,
  SELF_CHECK,
  sessionTitle,
  speakingPart,
  stripMarkers,
  TALK_SECONDS,
  type SpeakingPart,
} from '../../lib/speakingExam';
import { useLevel } from '../../hooks/useLevel';
import { useEntries } from '../../hooks/useEntries';
import { useRecorder, type Recording } from '../../hooks/useRecorder';
import { TopBar } from '../common/TopBar';
import { BackButton } from '../common/BackButton';
import { EmptyState } from '../common/EmptyState';

const PART_INFO: Record<SpeakingPart, { name: string; rule: string }> = {
  1: { name: '身近な話題', rule: `質問に1問${ANSWER_SECONDS[1]}秒ずつ答えます` },
  2: { name: 'スピーチ', rule: `${PREP_SECONDS / 60}分準備して、${TALK_SECONDS / 60}分話します` },
  3: { name: 'ディスカッション', rule: `質問に1問${ANSWER_SECONDS[3]}秒ずつ答えます` },
};

/** 内蔵の Speaking の質問すべて(speaking-1 から順に。番号が飛んでいても拾う) */
let promptCache: [string, TaskPrompt][] | null = null;
function allSpeakingPrompts(): [string, TaskPrompt][] {
  if (!promptCache) {
    promptCache = [];
    for (let n = 1; n <= 200; n++) {
      const id = `speaking-${n}`;
      const p = getSpeakingPrompt(id);
      if (p) promptCache.push([id, p]);
    }
  }
  return promptCache;
}

export function SpeakingExamScreen() {
  const { presetId } = useParams<{ presetId: string }>();
  if (!presetId) return <ChooseView />;
  const id = basePresetId(presetId);
  const prompt = getSpeakingPrompt(id);
  const part = prompt ? speakingPart(prompt) : null;
  if (!prompt || !part || examQuestions(prompt, part).length === 0) {
    return (
      <div className="app-shell">
        <TopBar title="Speaking 模試" left={<BackButton to="/speaking-exam" />} />
        <EmptyState message="この質問は見つかりませんでした" />
      </div>
    );
  }
  return <SpeakingExam key={id} presetId={id} prompt={prompt} part={part} />;
}

/* ───────── 質問を選ぶ ───────── */

function ChooseView() {
  const navigate = useNavigate();
  const { level } = useLevel();
  const groups = useMemo(() => groupByPart(allSpeakingPrompts()), []);
  const withModel = useMemo(
    () => new Set(levelTopics(level.id, 'speaking').map((t) => basePresetId(t.presetId))),
    [level.id],
  );
  const open = (id: string) => navigate(`/speaking-exam/${id}`);
  const empty = ([1, 2, 3] as SpeakingPart[]).every((p) => groups[p].length === 0);

  return (
    <div className="app-shell">
      <TopBar title="Speaking 模試" left={<BackButton to="/" />} />
      {empty ? (
        <EmptyState message="この版には Speaking の質問が入っていません" />
      ) : (
        <div className="screen-body">
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            質問を選ぶと、本番と同じ時間で答えを録音します。
            <span style={{ ...badgeStyle, marginLeft: 4 }}>モデル</span> は今のレベル({level.name} {level.band}
            )のモデルアンサーがある質問です。
          </div>
          {([1, 2, 3] as SpeakingPart[]).map((part) =>
            groups[part].length === 0 ? null : (
              <div key={part} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="section-label" style={{ marginBottom: 0 }}>
                  Part {part} ・ {PART_INFO[part].name}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{PART_INFO[part].rule}</div>
                {groups[part].map((c) => (
                  <button key={c.id} onClick={() => open(c.id)} style={choiceStyle}>
                    <span style={{ flex: 1, fontFamily: 'var(--font-serif)', fontSize: 15 }}>{c.title}</span>
                    {part !== 2 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{c.questionCount}問</span>
                    )}
                    {withModel.has(c.id) && <span style={badgeStyle}>モデル</span>}
                  </button>
                ))}
                <button
                  className="secondary-btn"
                  style={{ padding: 10 }}
                  onClick={() => {
                    const c = pickRandom(groups[part]);
                    if (c) open(c.id);
                  }}
                >
                  ランダム
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

const choiceStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  textAlign: 'left',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg)',
  color: 'var(--text)',
  padding: '10px 12px',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  flexShrink: 0,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--success)',
  background: 'var(--success-soft)',
  borderRadius: 999,
  padding: '2px 8px',
};

/* ───────── 本番 ───────── */

type Phase = 'ready' | 'running' | 'review';

interface Answer {
  index: number;
  question: string;
  seconds: number;
  recording: Recording | null;
}

function SpeakingExam({ presetId, prompt, part }: { presetId: string; prompt: TaskPrompt; part: SpeakingPart }) {
  const navigate = useNavigate();
  const recorder = useRecorder();
  const canSpeak = speechSupported();
  const questions = useMemo(() => examQuestions(prompt, part), [prompt, part]);
  const steps = useMemo(() => examSteps(part, questions.length), [part, questions.length]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [starting, setStarting] = useState(false);
  const [voice, setVoiceState] = useState(canSpeak);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepStartedAt, setStepStartedAt] = useState(0);
  const [recording, setRecording] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [notes, setNotes] = useState('');
  const [totalSeconds, setTotalSeconds] = useState(0);
  const now = useNow(phase === 'running');

  const voiceRef = useRef(voice);
  const stepRef = useRef(0);
  const advancingRef = useRef(false);
  const sessionStartRef = useRef(0);

  const step = steps[stepIndex]!;
  const remaining = remainingSeconds(step.seconds, Math.max(0, now - stepStartedAt));
  const question = questions[step.index] ?? '';

  const setVoice = (on: boolean) => {
    voiceRef.current = on;
    setVoiceState(on);
  };

  // 画面を離れたら読み上げを止める(録音とマイクは useRecorder が片付ける)
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const goTo = (i: number | null) => {
    if (i === null) return finish();
    stepRef.current = i;
    setStepIndex(i);
    setStepStartedAt(timestamp());
    setRecording(steps[i]!.kind === 'speak' && recorder.start());
  };

  const finish = () => {
    recorder.release();
    window.speechSynthesis?.cancel();
    const seconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
    setTotalSeconds(seconds);
    logActivity({ kind: 'speaking', title: sessionTitle(prompt, part), seconds });
    setPhase('review');
  };

  /** i 番目の段階を終えて次へ進む(時間切れとボタンが重なっても1回だけ) */
  const advanceFrom = async (i: number) => {
    if (stepRef.current !== i || advancingRef.current) return;
    const current = steps[i]!;
    if (current.kind === 'speak') {
      advancingRef.current = true;
      const elapsed = Math.min(current.seconds, (Date.now() - stepStartedAt) / 1000);
      const rec = await recorder.stop();
      setRecording(false);
      setAnswers((a) => [...a, { index: current.index, question: questions[current.index]!, seconds: rec?.seconds ?? elapsed, recording: rec }]);
      advancingRef.current = false;
    }
    goTo(nextStepIndex(steps, i, { voice: voiceRef.current }));
  };

  const start = async () => {
    // iOS Safari はタップの中で1度読み上げないと、あとから読み上げられないので、空の文で鳴らしておく
    if (voiceRef.current) {
      try {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
      } catch {
        // 読み上げられなくても続ける
      }
    }
    setStarting(true);
    recorder.clearRecordings();
    await recorder.prepare();
    setStarting(false);
    setAnswers([]);
    setNotes('');
    advancingRef.current = false;
    sessionStartRef.current = Date.now();
    setPhase('running');
    goTo(firstStepIndex(steps, { voice: voiceRef.current }));
  };

  const restart = () => {
    window.speechSynthesis?.cancel();
    recorder.clearRecordings();
    setAnswers([]);
    setPhase('ready');
  };

  // 効果の中からは、いつも最新の advanceFrom を呼ぶ
  const advanceRef = useRef(advanceFrom);
  useEffect(() => {
    advanceRef.current = advanceFrom;
  });

  // 質問を読み上げ、終わったら話す時間へ。終わりが知らされない端末のために、目安の時間でも進める
  const listening = phase === 'running' && step.kind === 'listen';
  useEffect(() => {
    if (!listening) return;
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      void advanceRef.current(stepIndex);
    };
    if (!voice) {
      const t = window.setTimeout(next, 0);
      return () => window.clearTimeout(t);
    }
    const stop = speak([question], { rate: 0.95, onEnd: next });
    const fallback = window.setTimeout(next, listenFallbackMs(question));
    return () => {
      done = true;
      stop();
      window.clearTimeout(fallback);
    };
  }, [listening, stepIndex, voice, question]);

  // 時間切れで次へ
  const limit = phase === 'running' ? step.seconds : 0;
  useEffect(() => {
    if (limit === 0) return;
    const t = window.setTimeout(() => void advanceRef.current(stepIndex), Math.max(0, stepStartedAt + limit * 1000 - Date.now()));
    return () => window.clearTimeout(t);
  }, [limit, stepIndex, stepStartedAt]);

  const title = `Speaking Part ${part}`;

  if (phase === 'ready') {
    return (
      <div className="app-shell">
        <TopBar title={title} left={<BackButton to="/speaking-exam" />} />
        <div className="screen-body">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              Part {part} ・ {PART_INFO[part].name}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 700 }}>{prompt.title}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              {PART_INFO[part].rule}
              {part !== 2 && `(全${questions.length}問)`}。
              {part === 2 ? 'トピックカードは始めると表示されます。' : '時間内に話し終えたら「次の質問」で進めます。'}
            </div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.6 }}>
            {part !== 2 &&
              (canSpeak ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
                  質問を音声で読み上げる
                </label>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>この端末は読み上げに対応していないので、質問は文字だけで出します。</div>
              ))}
            <div style={{ color: 'var(--text-muted)' }}>
              答えは録音して、終わったあとに聞き直せます。マイクの使用を許可してください。録音はこの画面を離れると消え、保存はされません。
            </div>
          </div>
          <button className="primary-btn" onClick={() => void start()} disabled={starting}>
            {starting ? 'マイクを準備しています…' : '始める'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <ReviewView
        title={title}
        presetId={presetId}
        prompt={prompt}
        part={part}
        answers={answers}
        notes={notes}
        totalSeconds={totalSeconds}
        micUnavailable={recorder.status === 'denied' || recorder.status === 'unsupported'}
        onRestart={restart}
        onChoose={() => navigate('/speaking-exam')}
      />
    );
  }

  const speaking = step.kind === 'speak';
  const isLast = nextStepIndex(steps, stepIndex, { voice }) === null;
  const timerLabel = step.kind === 'listen' ? '質問' : step.kind === 'prep' ? '準備時間' : '話す時間';
  const micNote =
    recorder.status === 'denied'
      ? 'マイクが許可されなかったので、録音せずに続けます。'
      : recorder.status === 'unsupported'
        ? 'この端末は録音に対応していないので、録音せずに続けます。'
        : null;

  return (
    <div className="app-shell">
      <TopBar
        title={title}
        left={<BackButton to="/speaking-exam" />}
        right={
          part !== 2 ? (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {step.index + 1} / {questions.length}
            </span>
          ) : undefined
        }
      />
      <div className="screen-body">
        <div className="card" style={{ textAlign: 'center', padding: '18px 18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: 'var(--accent)' }}>{timerLabel}</span>
            {recording && <span style={{ color: 'var(--brand-red)' }}>● 録音中</span>}
          </div>
          <div
            role="timer"
            aria-label={`${timerLabel}の残り`}
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
              color: step.kind === 'listen' ? 'var(--text-muted)' : speaking && remaining <= 10 ? 'var(--danger)' : 'var(--text)',
            }}
          >
            {step.kind === 'listen' ? formatClock(ANSWER_SECONDS[part === 3 ? 3 : 1]) : formatClock(remaining)}
          </div>
          {step.kind === 'listen' && (
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>読み上げが終わると始まります</div>
          )}
        </div>

        {micNote && <div style={{ fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.6 }}>{micNote}</div>}

        {part === 2 ? (
          <CueCard prompt={prompt} />
        ) : (
          <div className="card">
            <div className="section-label">試験官の質問</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, lineHeight: 1.55 }}>{question}</div>
            {canSpeak && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
                質問を音声で読み上げる
              </label>
            )}
          </div>
        )}

        {part === 2 && (
          <div className="card">
            <div className="section-label">メモ</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="話す内容をメモ(キーワードだけで十分です)"
              aria-label="メモ"
              rows={5}
              style={{
                width: '100%',
                resize: 'vertical',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--text)',
              }}
            />
          </div>
        )}

        <button className="primary-btn" onClick={() => void advanceFrom(stepIndex)}>
          {step.kind === 'listen'
            ? '話し始める'
            : step.kind === 'prep'
              ? '準備を終えて話し始める'
              : isLast
                ? '終える'
                : '次の質問'}
        </button>
      </div>
    </div>
  );
}

function CueCard({ prompt }: { prompt: TaskPrompt }) {
  return (
    <div className="card" style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.6 }}>
      <div className="section-label" style={{ fontFamily: 'var(--font-ui)' }}>
        トピックカード
      </div>
      {prompt.paragraphs.map((p, i) => (
        <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0', fontWeight: i === 0 ? 700 : 400 }}>
          {p}
        </p>
      ))}
      <ul style={{ margin: '4px 0 0', paddingLeft: 22 }}>
        {prompt.requirements.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── ふり返り ───────── */

function ReviewView({
  title,
  presetId,
  prompt,
  part,
  answers,
  notes,
  totalSeconds,
  micUnavailable,
  onRestart,
  onChoose,
}: {
  title: string;
  presetId: string;
  prompt: TaskPrompt;
  part: SpeakingPart;
  answers: Answer[];
  notes: string;
  totalSeconds: number;
  micUnavailable: boolean;
  onRestart: () => void;
  onChoose: () => void;
}) {
  const navigate = useNavigate();
  const { level } = useLevel();
  const { entries } = useEntries();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const model = useMemo(() => modelTopicFor(presetId, levelTopics(level.id, 'speaking')), [presetId, level.id]);
  const modelEntry = model ? entries.find((e) => e.presetId === model.presetId) : undefined;
  const anyRecording = answers.some((a) => a.recording);

  useEffect(() => () => stopRef.current?.(), []);

  const toggleCheck = (key: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleModel = () => {
    if (playing) {
      stopRef.current?.();
      stopRef.current = null;
      setPlaying(false);
      return;
    }
    if (!model) return;
    setPlaying(true);
    stopRef.current = speak(splitSentences(stripMarkers(model.text)), { rate: 0.95, onEnd: () => setPlaying(false) });
  };

  const checkCount = SELF_CHECK.reduce((n, c) => n + c.items.length, 0);

  return (
    <div className="app-shell">
      <TopBar title={title} left={<BackButton to="/speaking-exam" />} />
      <div className="screen-body">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="section-label" style={{ marginBottom: 4 }}>
              終了
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700 }}>{prompt.title}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
            かかった時間
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
              {formatClock(totalSeconds)}
            </div>
          </div>
        </div>

        {!anyRecording && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {micUnavailable ? 'マイクが使えなかったので、録音はありません。' : '録音はありません。'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            録音を聞き直す
          </div>
          {answers.map((a) => (
            <div key={a.index} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ color: 'var(--accent)' }}>{part === 2 ? 'スピーチ' : `質問 ${a.index + 1}`}</span>
                <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatClock(a.seconds)}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.55 }}>{a.question}</div>
              {a.recording ? (
                <audio controls preload="metadata" src={a.recording.url} style={{ width: '100%' }} />
              ) : (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>録音なし</div>
              )}
            </div>
          ))}
        </div>

        {part === 2 && notes.trim() && (
          <div className="card">
            <div className="section-label">メモ</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>{notes}</div>
          </div>
        )}

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-label" style={{ marginBottom: 0, display: 'flex', justifyContent: 'space-between' }}>
            <span>セルフチェック</span>
            <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {checked.size} / {checkCount}
            </span>
          </div>
          {SELF_CHECK.map((c) => (
            <div key={c.criterion}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                {c.criterion}
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{c.ja}</span>
              </div>
              {c.items.map((item) => {
                const key = `${c.criterion}:${item}`;
                return (
                  <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6, fontSize: 13.5, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={checked.has(key)} onChange={() => toggleCheck(key)} style={{ marginTop: 3 }} />
                    {item}
                  </label>
                );
              })}
            </div>
          ))}
        </div>

        {model && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              モデルアンサー({level.name} {level.band})
            </div>
            {speechSupported() && (
              <button className="secondary-btn" style={{ padding: 12 }} onClick={toggleModel}>
                {playing ? '読み上げを止める' : 'モデルアンサーを聞く'}
              </button>
            )}
            {modelEntry && (
              <button className="secondary-btn" style={{ padding: 12 }} onClick={() => navigate(`/entries/${modelEntry.id}`)}>
                モデルアンサーを見る
              </button>
            )}
          </div>
        )}

        <button className="primary-btn" onClick={onRestart}>
          もう一度答える
        </button>
        <button className="secondary-btn" onClick={onChoose}>
          別の質問を選ぶ
        </button>
      </div>
    </div>
  );
}

/** 今の時刻(ミリ秒)。押したときや時間切れのときに呼ぶ */
function timestamp(): number {
  return Date.now();
}

/** 動いている間、今の時刻を短い間隔で返す */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}
