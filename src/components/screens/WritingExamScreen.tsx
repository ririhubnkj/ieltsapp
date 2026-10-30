import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useLevel } from '../../hooks/useLevel';
import { levelTopics, type Level } from '../../lib/levels';
import { getAllPresetTopics, getTask1Figure, getTask2ModelPrompt } from '../../lib/presetLibrary';
import type { PresetTopic } from '../../lib/presets';
import { svgDataUrl } from '../../lib/figureImage';
import { logActivity } from '../../lib/activity';
import {
  CRITERIA,
  splitTemplateLine,
  TEMPLATES,
  type WritingTask,
  type WritingTemplate,
} from '../../lib/writingTemplates';
import {
  buildAiPrompt,
  checkEssay,
  countWords,
  EXAM_MINUTES,
  firstSentence,
  MIN_WORDS,
  task1Kind,
  task1QuestionFromEssay,
  task1TemplateId,
  task2TemplateId,
  task2TypeLabel,
} from '../../lib/writingCheck';
import { TopBar } from '../common/TopBar';
import { BackButton } from '../common/BackButton';
import { TaskFigure } from '../common/TaskFigure';
import { BackIcon } from '../common/icons';

/** 本番形式で解く1問 */
interface ExamQuestion {
  task: WritingTask;
  presetId: string;
  /** 題材の名前(番号を除いたもの。例: メリデメ｜在宅勤務) */
  title: string;
  /** 問題の型(Task 2 は Type: の値、Task 1 は 表・折れ線 など) */
  typeLabel: string;
  template: WritingTemplate | null;
  /** 問題文 */
  question: string;
  /** Task 1 の図の説明(モデルエッセイの最初の文) */
  chartDescription?: string;
  /** Task 1 の図(data URL) */
  figure: string | null;
}

type View = 'setup' | 'writing' | 'result';

const TASKS: WritingTask[] = ['task2', 'task1'];
const TASK_NAME: Record<WritingTask, string> = { task1: 'Task 1', task2: 'Task 2' };
const BANDS = ['4.0', '4.5', '5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];

/** 採点基準ごとの自己チェック */
const SELF_CHECK: Record<string, string[]> = {
  'Task Achievement': [
    'Overview(全体の傾向)を第2段落に書いた',
    '大事な数字を正しく取り上げて比べた',
    '図に無いことや自分の意見を書いていない',
  ],
  'Task Response': [
    '問題の問いすべてに答えた',
    '立場や主張が最初から最後まで変わっていない',
    '理由に具体例を付けた',
  ],
  'Coherence and Cohesion': [
    '1つの段落に1つの話題だけを書いた',
    '接続表現を同じものばかりにせず、自然に使った',
    'this / these / such などで前の文とつないだ',
  ],
  'Lexical Resource': [
    '同じ語をくり返さず、言い換えた',
    '自然な語の組み合わせ(コロケーション)を使った',
    'スペルミスを見直した',
  ],
  'Grammatical Range and Accuracy': [
    '短い文だけでなく、接続詞や関係詞でつないだ文も使った',
    '時制と、主語と動詞の一致を見直した',
    '冠詞(a / the)と複数形の s を見直した',
  ],
};

// --- 書きかけの保存(この端末だけ) ---

const DRAFT_KEY = 'ielts_writing_exam_drafts_v1';
const CURRENT_KEY = 'ielts_writing_exam_current_v1';

interface Draft {
  text: string;
  seconds: number;
}

function loadDrafts(): Record<string, Draft> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Draft>) : {};
  } catch {
    return {};
  }
}

function loadDraft(presetId: string): Draft | null {
  const d = loadDrafts()[presetId];
  return d && typeof d.text === 'string' ? { text: d.text, seconds: Number(d.seconds) || 0 } : null;
}

function saveDraft(presetId: string, draft: Draft | null) {
  try {
    const drafts = loadDrafts();
    if (draft && draft.text.trim()) drafts[presetId] = draft;
    else delete drafts[presetId];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch {
    // 保存できない環境では保存しない
  }
}

function loadCurrent(): { task: WritingTask; presetId: string } | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY);
    const v = raw ? (JSON.parse(raw) as { task?: string; presetId?: string }) : null;
    return v && (v.task === 'task1' || v.task === 'task2') && v.presetId ? { task: v.task, presetId: v.presetId } : null;
  } catch {
    return null;
  }
}

function saveCurrent(current: { task: WritingTask; presetId: string } | null) {
  try {
    if (current) localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    // 保存できない環境では保存しない
  }
}

// --- 問題 ---

function buildQuestion(task: WritingTask, topic: PresetTopic): ExamQuestion | null {
  const title = topic.title.replace(/^\d+\.\s*/, '');
  if (task === 'task2') {
    const prompt = getTask2ModelPrompt(topic.presetId);
    if (!prompt) return null;
    const templateId = task2TemplateId(prompt.headers);
    return {
      task,
      presetId: topic.presetId,
      title,
      typeLabel: task2TypeLabel(prompt.headers),
      template: TEMPLATES.task2.find((t) => t.id === templateId) ?? null,
      question: prompt.paragraphs.join('\n'),
      figure: null,
    };
  }
  const svg = getTask1Figure(topic.presetId);
  const templateId = task1TemplateId(topic.presetId, topic.title);
  return {
    task,
    presetId: topic.presetId,
    title,
    typeLabel: task1Kind(topic.title),
    template: TEMPLATES.task1.find((t) => t.id === templateId) ?? null,
    question: task1QuestionFromEssay(topic.text),
    chartDescription: firstSentence(topic.text),
    figure: svg ? svgDataUrl(svg) : null,
  };
}

/** あるレベルで選べる問題(Task 2 は問題文のある全文モデル、Task 1 は図のある題材) */
function levelQuestions(level: Level, task: WritingTask): ExamQuestion[] {
  return levelTopics(level.id, task)
    .filter((t) => (task === 'task2' ? t.presetId.startsWith('task2model-') : t.presetId.startsWith('task1-')))
    .map((t) => buildQuestion(task, t))
    .filter((q): q is ExamQuestion => !!q);
}

function findQuestion(task: WritingTask, presetId: string | null): ExamQuestion | null {
  if (!presetId || !presetId.startsWith(task === 'task1' ? 'task1-' : 'task2model-')) return null;
  const topic = getAllPresetTopics().find((t) => t.presetId === presetId);
  return topic ? buildQuestion(task, topic) : null;
}

function parseTask(value: string | null): WritingTask | null {
  return value === 'task1' || value === 'task2' ? value : null;
}

function formatTime(total: number): string {
  const t = Math.abs(total);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// --- 画面 ---

/** Writing の本番モード: 問題を選ぶ → 時間を計って書く → 点検と自己チェック、AI 添削用のプロンプト */
export function WritingExamScreen() {
  const { level } = useLevel();
  const [params, setParams] = useSearchParams();
  // URL の ?task=&id= を読むのは最初の1回だけ
  const [initial] = useState(() => {
    const task = parseTask(params.get('task')) ?? 'task2';
    return { task, question: findQuestion(task, params.get('id')) };
  });
  const [task, setTask] = useState<WritingTask>(initial.task);
  const [question, setQuestion] = useState<ExamQuestion | null>(initial.question);
  const [view, setView] = useState<View>(initial.question ? 'writing' : 'setup');
  const [result, setResult] = useState<{ text: string; seconds: number } | null>(null);

  const start = (q: ExamQuestion) => {
    setQuestion(q);
    setTask(q.task);
    setView('writing');
    saveCurrent({ task: q.task, presetId: q.presetId });
    setParams({ task: q.task, id: q.presetId }, { replace: true });
  };

  const backToSetup = () => {
    setView('setup');
    setResult(null);
    setParams({ task }, { replace: true });
  };

  const finish = (text: string, seconds: number) => {
    if (!question) return;
    logActivity({
      kind: 'writing',
      title: `${TASK_NAME[question.task]} 本番: ${question.title}`,
      score: countWords(text),
      seconds,
    });
    saveDraft(question.presetId, null);
    saveCurrent(null);
    setResult({ text, seconds });
    setView('result');
  };

  const retry = () => {
    if (!question) return;
    saveDraft(question.presetId, null);
    setResult(null);
    start(question);
  };

  if (view === 'writing' && question) {
    return <WritingView key={question.presetId} question={question} onBack={backToSetup} onFinish={finish} />;
  }
  if (view === 'result' && question && result) {
    return (
      <ResultView
        question={question}
        text={result.text}
        seconds={result.seconds}
        level={level}
        onBack={backToSetup}
        onRetry={retry}
      />
    );
  }
  return (
    <SetupView
      task={task}
      level={level}
      onTask={(t) => {
        setTask(t);
        setParams({ task: t }, { replace: true });
      }}
      onStart={start}
    />
  );
}

function SetupView({
  task,
  level,
  onTask,
  onStart,
}: {
  task: WritingTask;
  level: Level;
  onTask: (t: WritingTask) => void;
  onStart: (q: ExamQuestion) => void;
}) {
  const questions = useMemo(() => levelQuestions(level, task), [level, task]);
  const [resume, setResume] = useState(() => {
    const current = loadCurrent();
    const draft = current ? loadDraft(current.presetId) : null;
    const q = current && draft ? findQuestion(current.task, current.presetId) : null;
    return q && draft ? { question: q, words: countWords(draft.text) } : null;
  });

  const random = () => {
    const q = questions[Math.floor(Math.random() * questions.length)];
    if (q) onStart(q);
  };

  return (
    <div className="app-shell">
      <TopBar title="Writing 本番モード" left={<BackButton to="/" />} />
      <div className="screen-body">
        <div role="tablist" style={{ display: 'flex', gap: 6 }}>
          {TASKS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === task}
              onClick={() => onTask(t)}
              style={{
                flex: 1,
                border: '1.5px solid ' + (t === task ? 'var(--accent)' : 'var(--border)'),
                background: t === task ? 'var(--accent)' : 'var(--surface)',
                color: t === task ? '#fff' : 'var(--text-muted)',
                borderRadius: 999,
                padding: '7px 0',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {TASK_NAME[t]}({EXAM_MINUTES[t]}分)
            </button>
          ))}
        </div>

        {resume && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, borderColor: 'var(--pin)' }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              書きかけの答案があります
              <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                {TASK_NAME[resume.question.task]}・{resume.question.title}({resume.words}語)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="secondary-btn"
                style={{ flex: 1, padding: 10 }}
                onClick={() => {
                  saveDraft(resume.question.presetId, null);
                  saveCurrent(null);
                  setResume(null);
                }}
              >
                捨てる
              </button>
              <button className="primary-btn" style={{ flex: 1, padding: 10 }} onClick={() => onStart(resume.question)}>
                続きを書く
              </button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {TASK_NAME[task]}は{EXAM_MINUTES[task]}分で{MIN_WORDS[task]}語以上を書きます。レベル「{level.name}」(バンド
          {level.band})の問題から選んでください。始めると時間を計ります。
        </div>

        {questions.length === 0 ? (
          <div className="card" style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            このレベルには{TASK_NAME[task]}の問題がありません。
          </div>
        ) : (
          <>
            <button className="secondary-btn" onClick={random}>
              ランダムに選ぶ
            </button>
            {questions.map((q) => (
              <button
                key={q.presetId}
                className="card"
                onClick={() => onStart(q)}
                style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', color: 'var(--text)' }}
              >
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, width: '100%' }}>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'var(--accent)',
                      background: 'var(--accent-soft)',
                      borderRadius: 4,
                      padding: '1px 6px',
                      flexShrink: 0,
                    }}
                  >
                    {q.typeLabel}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>{q.title.split('｜').pop()}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>書く →</span>
                </span>
                {q.figure && (
                  <img
                    src={q.figure}
                    alt=""
                    style={{
                      display: 'block',
                      width: '100%',
                      maxHeight: 170,
                      objectFit: 'contain',
                      background: '#fff',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                    }}
                  />
                )}
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {q.question}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function WritingView({
  question,
  onBack,
  onFinish,
}: {
  question: ExamQuestion;
  onBack: () => void;
  onFinish: (text: string, seconds: number) => void;
}) {
  const [initialDraft] = useState(() => loadDraft(question.presetId));
  const [text, setText] = useState(initialDraft?.text ?? '');
  const [seconds, setSeconds] = useState(initialDraft?.seconds ?? 0);
  const [showQuestion, setShowQuestion] = useState(true);
  const [showTemplate, setShowTemplate] = useState(false);
  const words = countWords(text);
  const target = MIN_WORDS[question.task];
  const remaining = EXAM_MINUTES[question.task] * 60 - seconds;
  const over = remaining < 0;

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 書きかけを端末に保存し、再読み込みしても続きから書けるようにする
  useEffect(() => {
    saveDraft(question.presetId, { text, seconds });
  }, [question.presetId, text, seconds]);

  return (
    <div className="app-shell app-shell--viewport">
      <TopBar
        title={`${TASK_NAME[question.task]} 本番`}
        left={
          <button className="icon-btn" onClick={onBack} aria-label="問題選びに戻る">
            <BackIcon />
          </button>
        }
        right={
          <span
            aria-label={over ? '超過時間' : '残り時間'}
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: over ? 'var(--danger)' : 'var(--text)',
            }}
          >
            {over ? `+${formatTime(remaining)} 超過` : `残り ${formatTime(remaining)}`}
          </span>
        }
      />
      {question.figure && <TaskFigure src={question.figure} />}

      <div className="screen-body" style={{ gap: 12 }}>
        <div className="card" style={{ padding: '10px 14px' }}>
          <button
            onClick={() => setShowQuestion(!showQuestion)}
            aria-expanded={showQuestion}
            style={{
              width: '100%',
              display: 'flex',
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--accent)',
            }}
          >
            問題({question.typeLabel})
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontWeight: 400 }}>{showQuestion ? '▲' : '▼'}</span>
          </button>
          {showQuestion && (
            <div style={{ marginTop: 8, fontFamily: 'var(--font-serif)', fontSize: 14.5, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
              {question.question}
              {question.task === 'task2' && (
                <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--text-muted)', fontSize: 13.5 }}>
                  Write at least 250 words.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
            <b style={{ color: words >= target ? 'var(--success)' : 'var(--text)' }}>{words}</b>
            <span style={{ color: 'var(--text-muted)' }}> / {target}語</span>
          </span>
          {question.template && (
            <button
              onClick={() => setShowTemplate(!showTemplate)}
              aria-expanded={showTemplate}
              style={{
                marginLeft: 'auto',
                border: '1.5px solid var(--border)',
                background: showTemplate ? 'var(--accent-soft)' : 'var(--surface)',
                color: 'var(--accent)',
                borderRadius: 999,
                padding: '5px 12px',
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {showTemplate ? '型を隠す' : '型を見る'}
            </button>
          )}
        </div>

        {showTemplate && question.template && <TemplatePanel template={question.template} />}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ここに英文を書く(段落の間は改行する)"
          aria-label="答案"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="sentences"
          style={{
            flexShrink: 0,
            minHeight: '55dvh',
            resize: 'vertical',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '12px 14px',
            fontFamily: 'var(--font-serif)',
            fontSize: 16,
            lineHeight: 1.7,
            color: 'var(--text)',
          }}
        />

        <button className="primary-btn" disabled={!text.trim()} onClick={() => onFinish(text, seconds)}>
          書き終えた
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
          書きかけはこの端末に自動で保存されます
        </div>
      </div>
    </div>
  );
}

function TemplatePanel({ template }: { template: WritingTemplate }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px' }}>
      <div className="section-label" style={{ marginBottom: 0 }}>
        型: {template.name}
      </div>
      {template.paragraphs.map((p) => (
        <div key={p.label} style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{p.label}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {p.lines.map((line) => (
              <div key={line} style={{ fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.55 }}>
                {splitTemplateLine(line).map((part, i) =>
                  part.slot ? (
                    <span
                      key={i}
                      style={{
                        fontSize: 12,
                        color: 'var(--pin-text)',
                        background: 'var(--pin-soft)',
                        borderRadius: 4,
                        padding: '0 3px',
                      }}
                    >
                      {part.text}
                    </span>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultView({
  question,
  text,
  seconds,
  level,
  onBack,
  onRetry,
}: {
  question: ExamQuestion;
  text: string;
  seconds: number;
  level: Level;
  onBack: () => void;
  onRetry: () => void;
}) {
  const navigate = useNavigate();
  const { data } = useAppData();
  const words = countWords(text);
  const limit = EXAM_MINUTES[question.task] * 60;
  const checks = useMemo(
    () => checkEssay({ task: question.task, text, template: question.template, question: question.question }),
    [question, text],
  );
  const passed = checks.filter((c) => c.ok).length;
  const prompt = useMemo(
    () =>
      buildAiPrompt({
        task: question.task,
        question: question.question,
        chartDescription: question.chartDescription,
        targetBand: level.band,
        essay: text,
        template: question.template,
        seconds,
      }),
    [question, level.band, text, seconds],
  );
  const modelEntry = data.entries.find((e) => e.presetId === question.presetId);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [band, setBand] = useState<string | null>(null);
  const [showEssay, setShowEssay] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState('copied');
    } catch {
      // クリップボードが使えない環境では、全文を選んで手でコピーしてもらう
      const el = promptRef.current;
      if (!el) return;
      el.focus();
      el.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      setCopyState(ok ? 'copied' : 'selected');
    }
  };

  return (
    <div className="app-shell">
      <TopBar
        title="結果"
        left={
          <button className="icon-btn" onClick={onBack} aria-label="問題選びに戻る">
            <BackIcon />
          </button>
        }
      />
      <div className="screen-body">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {words}
            <span style={{ fontSize: 15, color: 'var(--text-muted)' }}> 語</span>
          </div>
          <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ color: 'var(--text)' }}>
              {TASK_NAME[question.task]}・{question.title}
            </div>
            <div>
              かかった時間{' '}
              <b style={{ color: seconds > limit ? 'var(--danger)' : 'var(--text)' }}>{formatTime(seconds)}</b>(制限
              {EXAM_MINUTES[question.task]}分)
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-label">
            自動チェック {passed}/{checks.length}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checks.map((c) => (
              <li key={c.label} style={{ display: 'flex', gap: 10 }}>
                <span
                  aria-label={c.ok ? 'OK' : '要確認'}
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    background: c.ok ? 'var(--success-soft)' : 'var(--pin-soft)',
                    color: c.ok ? 'var(--success)' : 'var(--pin-text)',
                  }}
                >
                  {c.ok ? '✓' : '!'}
                </span>
                <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 600 }}>{c.label}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            形の点検だけです。文法や内容の正しさは、下の自己チェックと AI 添削で確かめてください。
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px' }}>
          <button
            onClick={() => setShowEssay(!showEssay)}
            aria-expanded={showEssay}
            style={{
              width: '100%',
              display: 'flex',
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            自分の答案
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{showEssay ? '▲' : '▼'}</span>
          </button>
          {showEssay && (
            <div style={{ marginTop: 10, fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {text}
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            自己チェック(採点基準4項目)
          </div>
          {CRITERIA[question.task].map((c) => (
            <div key={c.name}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                {c.name}
                <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{c.nameJa}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {(SELF_CHECK[c.name] ?? []).map((label, i) => {
                  const key = `${c.name}-${i}`;
                  return (
                    <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5 }}>
                      <input
                        type="checkbox"
                        checked={!!checked[key]}
                        onChange={(e) => setChecked((prev) => ({ ...prev, [key]: e.target.checked }))}
                        style={{ marginTop: 3, accentColor: 'var(--accent)' }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>自分で付けるバンド(目安)</div>
            <div role="radiogroup" aria-label="自分で付けるバンド" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {BANDS.map((b) => (
                <button
                  key={b}
                  role="radio"
                  aria-checked={band === b}
                  onClick={() => setBand(band === b ? null : b)}
                  style={{
                    minWidth: 44,
                    border: '1.5px solid ' + (band === b ? 'var(--accent)' : 'var(--border)'),
                    background: band === b ? 'var(--accent-soft)' : 'var(--surface)',
                    color: 'var(--text)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: 13,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {b}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              目標はバンド {level.band} です。AI 添削のバンドと比べてみてください。
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            AI添削用プロンプト
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Claude や ChatGPT などに貼り付けて使えます。
            {question.task === 'task1' && '図はスクリーンショットを撮って一緒に添付してください。'}
          </div>
          <textarea
            ref={promptRef}
            readOnly
            value={prompt}
            aria-label="AI添削用プロンプト"
            rows={10}
            onFocus={(e) => e.currentTarget.select()}
            style={{
              resize: 'vertical',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 12.5,
              lineHeight: 1.55,
              color: 'var(--text)',
            }}
          />
          <button className="primary-btn" style={{ padding: 12 }} onClick={copy}>
            {copyState === 'copied' ? 'コピーしました' : 'コピー'}
          </button>
          {copyState === 'selected' && (
            <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>
              自動でコピーできませんでした。全文を選んだので、長押し(または Ctrl+C)でコピーしてください。
            </div>
          )}
        </div>

        {modelEntry && (
          <button className="secondary-btn" onClick={() => navigate(`/entries/${modelEntry.id}`)}>
            モデルエッセイを見る
          </button>
        )}
        <button className="primary-btn" onClick={onRetry}>
          もう一度書く
        </button>
      </div>
    </div>
  );
}
