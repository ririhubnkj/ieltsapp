import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useLevel } from '../../hooks/useLevel';
import { allLevelTopics, LEVELS, levelOfPresetId, levelTopics, type ContentKind, type LevelId } from '../../lib/levels';
import { presetEntriesToAdd, presetEntriesToRefresh } from '../../lib/presets';
import { formatRelativeDate } from '../../lib/relativeDate';
import { dayKey, loadActivities, streakDays } from '../../lib/activity';
import { dueItems, loadReview } from '../../lib/review';
import { loadResults, passagesForLevel, totalMarks } from '../../lib/reading';
import type { Entry } from '../../types';
import { StatsPanel } from '../common/StatsPanel';
import { GearIcon } from '../common/icons';

type Tab = 'writing' | 'reading' | 'vocab' | 'speaking' | 'record';

const TABS: { id: Tab; label: string; heading: string }[] = [
  { id: 'writing', label: 'Writing', heading: 'Writing' },
  { id: 'reading', label: 'Reading', heading: 'Reading' },
  { id: 'vocab', label: '語彙', heading: 'Vocabulary' },
  { id: 'speaking', label: 'Speaking', heading: 'Speaking' },
  { id: 'record', label: '記録', heading: 'Record' },
];

const TAB_KEY = 'ielts_home_tab';
const WRITING_KEY = 'ielts_home_writing';

function loadPref<T extends string>(key: string, fallback: T, allowed: readonly string[]): T {
  try {
    const v = localStorage.getItem(key);
    return v && allowed.includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 保存できない環境では毎回最初のタブから
  }
}

/** 内蔵題材の種類 */
function kindOf(presetId: string | undefined): ContentKind | null {
  if (!presetId) return null;
  if (/^(topic-|task2model-)/.test(presetId)) return 'task2';
  if (presetId.startsWith('task1-')) return 'task1';
  if (presetId.startsWith('colloc-')) return 'vocab';
  if (presetId.startsWith('speaking-')) return 'speaking';
  return null;
}

/**
 * IELTS 版のホーム。選んだレベルの題材を最初から並べ、下のタブで技能を切り替える。
 * 題材は開いたときに足りない分を自動で追加する(自分で登録する必要はない)
 */
export function IeltsHomeScreen() {
  const navigate = useNavigate();
  const { data, dispatch } = useAppData();
  const { level, chosen, setLevel } = useLevel();
  const [tab, setTab] = useState<Tab>(() => loadPref(TAB_KEY, 'writing', TABS.map((t) => t.id)));
  const [writing, setWriting] = useState<'task2' | 'task1'>(() => loadPref(WRITING_KEY, 'task2', ['task2', 'task1']));
  const [pickingLevel, setPickingLevel] = useState(false);

  // 選んだレベルの題材をそろえる。内蔵題材の本文を直したときは、固定や除外をしていない英文だけ差し替える
  useEffect(() => {
    const topics = allLevelTopics(level.id);
    const add = presetEntriesToAdd(topics, data.entries);
    if (add.entries.length) dispatch({ type: 'ADD_ENTRIES', ...add });
    const refresh = presetEntriesToRefresh(topics, data.entries);
    const untouched = refresh.entries.filter((e) => {
      const old = data.entries.find((x) => x.id === e.id);
      return !old?.pinned?.length && !old?.excluded?.length && !old?.glosses;
    });
    if (untouched.length)
      dispatch({
        type: 'REPLACE_ENTRIES',
        entries: untouched,
        markings: refresh.markings.filter((m) => untouched.some((e) => e.id === m.entryId)),
      });
    // 英文の一覧が変わるたびに走らせると、追加した直後にもう一度比べるだけなので問題ない
  }, [level.id, data.entries, dispatch]);

  const selectTab = (t: Tab) => {
    setTab(t);
    savePref(TAB_KEY, t);
  };

  const activities = loadActivities();
  const today = dayKey(new Date());
  const todayCount = activities.filter((a) => dayKey(new Date(a.at)) === today).length;
  const streak = streakDays(activities);
  const due = dueItems(loadReview()).length;
  const goal = data.settings.dailyGoal ?? 3;

  if (!chosen || pickingLevel) {
    return (
      <LevelPicker
        current={chosen ? level.id : null}
        onPick={(id) => {
          setLevel(id);
          setPickingLevel(false);
        }}
        onCancel={chosen ? () => setPickingLevel(false) : undefined}
      />
    );
  }

  const heading = TABS.find((t) => t.id === tab)!.heading;

  return (
    <div className="app-shell app-shell--viewport">
      <header style={{ padding: '18px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setPickingLevel(true)}
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: 12,
              letterSpacing: '0.14em',
              color: 'var(--brand-red)',
              fontWeight: 700,
            }}
            aria-label="レベルを変える"
          >
            IELTS BAND {level.band} ・ {level.name}
            <span style={{ letterSpacing: 0, marginLeft: 6, color: 'var(--text-muted)', fontWeight: 400, textDecoration: 'underline' }}>
              変更
            </span>
          </button>
          <button className="icon-btn" style={{ marginLeft: 'auto', width: 34, height: 34 }} onClick={() => navigate('/settings')} aria-label="設定">
            <GearIcon />
          </button>
        </div>
        <h1 style={{ margin: '2px 0 0', fontSize: 34, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.01em' }}>{heading}</h1>
        <div
          style={{
            display: 'flex',
            gap: 14,
            fontSize: 12.5,
            color: 'var(--text-muted)',
            padding: '6px 0 10px',
            borderBottom: '2px solid var(--text)',
          }}
        >
          <span>
            今日 {todayCount}/{goal}
          </span>
          <span>連続 {streak}日</span>
          <button
            onClick={() => navigate('/review')}
            style={{
              marginLeft: 'auto',
              border: 'none',
              background: 'none',
              padding: 0,
              fontSize: 12.5,
              color: due ? 'var(--brand-red)' : 'var(--text-muted)',
              fontWeight: due ? 700 : 400,
            }}
          >
            復習 {due}語 →
          </button>
        </div>
      </header>

      <main className="screen-body" style={{ paddingTop: 12, paddingBottom: 24 }}>
        {tab === 'writing' && (
          <>
            <SubTabs
              value={writing}
              options={[
                ['task2', 'Task 2 エッセイ'],
                ['task1', 'Task 1 図表'],
              ]}
              onChange={(v) => {
                setWriting(v);
                savePref(WRITING_KEY, v);
              }}
            />
            <Links
              items={[
                [`${writing === 'task2' ? 'Task 2 の5つの型' : 'Task 1 の4つの型'}`, () => navigate(`/templates/${writing}`)],
                [`本番モード(${writing === 'task2' ? '40' : '20'}分で書く・添削プロンプトつき)`, () => navigate(`/writing-exam?task=${writing}`)],
              ]}
            />
            <Contents entries={data.entries} sessions={data.sessions} level={level.id} kind={writing} onOpen={(id) => navigate(`/entries/${id}`)} />
            <OwnEntries entries={data.entries} onOpen={(id) => navigate(`/entries/${id}`)} />
          </>
        )}
        {tab === 'reading' && <ReadingContents level={level.id} onOpen={(path) => navigate(path)} />}
        {tab === 'vocab' && (
          <>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              トピック別のコロケーションを、例文の穴埋めで覚えます。間違えた語は固定すると「復習」に入ります。
            </p>
            <Contents entries={data.entries} sessions={data.sessions} level={level.id} kind="vocab" onOpen={(id) => navigate(`/entries/${id}`)} />
          </>
        )}
        {tab === 'speaking' && (
          <>
            <Links items={[['本番モード(タイマーと録音)', () => navigate('/speaking-exam')]]} />
            <Contents entries={data.entries} sessions={data.sessions} level={level.id} kind="speaking" onOpen={(id) => navigate(`/entries/${id}`)} />
          </>
        )}
        {tab === 'record' && <StatsPanel />}
      </main>

      <nav
        style={{
          flexShrink: 0,
          display: 'flex',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                border: 'none',
                borderTop: `3px solid ${active ? 'var(--brand-red)' : 'transparent'}`,
                background: 'none',
                padding: '11px 0 13px',
                fontSize: 13.5,
                fontWeight: active ? 700 : 400,
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SubTabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 22, borderBottom: '1px solid var(--border)' }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={v === value}
          onClick={() => onChange(v)}
          style={{
            border: 'none',
            borderBottom: `2px solid ${v === value ? 'var(--accent)' : 'transparent'}`,
            background: 'none',
            padding: '4px 0 8px',
            marginBottom: -1,
            fontSize: 15,
            fontWeight: v === value ? 700 : 400,
            color: v === value ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 型・本番モードなどへの文字のリンク */
function Links({ items }: { items: [string, () => void][] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map(([label, onClick]) => (
        <button
          key={label}
          onClick={onClick}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: 'none',
            padding: '10px 0',
            fontSize: 14.5,
            color: 'var(--accent)',
            textAlign: 'left',
          }}
        >
          <span>{label}</span>
          <span aria-hidden>→</span>
        </button>
      ))}
    </div>
  );
}

/** 題材の見出しの「番号. 」を外し、「種類｜題名」を分ける */
function splitTitle(title: string | undefined): { group: string; name: string } {
  const t = (title ?? '').replace(/^\d+\.\s*/, '');
  const i = t.indexOf('｜');
  return i >= 0 ? { group: t.slice(0, i), name: t.slice(i + 1) } : { group: '本論のモデル', name: t };
}

/** 目次のように題材を並べる(種類ごとに見出しを付ける) */
function Contents({
  entries,
  sessions,
  level,
  kind,
  onOpen,
}: {
  entries: Entry[];
  sessions: { entryId: string; timestamp: string }[];
  level: LevelId;
  kind: ContentKind;
  onOpen: (id: string) => void;
}) {
  const order = useMemo(() => new Map(levelTopics(level, kind).map((t, i) => [t.presetId, i])), [level, kind]);
  const rows = entries
    .filter((e) => kindOf(e.presetId) === kind && levelOfPresetId(e.presetId) === level && order.has(e.presetId!))
    .sort((a, b) => order.get(a.presetId!)! - order.get(b.presetId!)!);
  const last = new Map<string, string>();
  for (const s of sessions) if (!last.has(s.entryId) || s.timestamp > last.get(s.entryId)!) last.set(s.entryId, s.timestamp);

  if (rows.length === 0)
    return <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>このレベルの題材は準備中です。</p>;

  let prevGroup = '';
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {rows.map((e, i) => {
        const { group, name } = splitTitle(e.title);
        const showGroup = group !== prevGroup;
        prevGroup = group;
        const studied = last.get(e.id);
        return (
          <li key={e.id}>
            {showGroup && (
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-red)', letterSpacing: '0.06em', padding: '16px 0 4px' }}>
                {group}
              </div>
            )}
            <button
              onClick={() => onOpen(e.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'none',
                padding: '11px 0',
                textAlign: 'left',
                color: 'var(--text)',
              }}
            >
              <span style={{ width: 22, flexShrink: 0, fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ flex: 1, fontSize: 15.5, lineHeight: 1.45 }}>{name}</span>
              <span style={{ flexShrink: 0, fontSize: 11.5, color: studied ? 'var(--success)' : 'var(--text-muted)' }}>
                {studied ? formatRelativeDate(studied) : '未学習'}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 以前に自分で登録した英文(今は登録の入口を出さないが、残っているものは開ける) */
function OwnEntries({ entries, onOpen }: { entries: Entry[]; onOpen: (id: string) => void }) {
  const own = entries.filter((e) => !e.presetId);
  if (own.length === 0) return null;
  return (
    <section>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-red)', letterSpacing: '0.06em', padding: '8px 0 4px' }}>自分の英文</div>
      {own.map((e) => (
        <button
          key={e.id}
          onClick={() => onOpen(e.id)}
          style={{
            width: '100%',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: 'none',
            padding: '11px 0',
            textAlign: 'left',
            fontSize: 15,
            color: 'var(--text)',
          }}
        >
          {e.title || e.tokens.slice(0, 8).join(' ')}
        </button>
      ))}
    </section>
  );
}

function ReadingContents({ level, onOpen }: { level: LevelId; onOpen: (path: string) => void }) {
  const passages = passagesForLevel(level);
  const results = loadResults();
  return (
    <>
      <Links items={[['模試(3題・60分・約40問)', () => onOpen('/reading-mock')]]} />
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {passages.map((p, i) => {
          const r = results[p.id];
          return (
            <li key={p.id}>
              <button
                onClick={() => onOpen(`/reading/${p.id}`)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'none',
                  padding: '12px 0',
                  textAlign: 'left',
                  color: 'var(--text)',
                }}
              >
                <span style={{ width: 22, flexShrink: 0, fontSize: 13, color: 'var(--text-muted)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 16, lineHeight: 1.4 }}>{p.title}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{p.titleJa}</span>
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, color: r ? 'var(--success)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {r ? `最高 ${r.best}/${r.total}` : `${totalMarks(p)}問`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {passages.length === 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>このレベルの演習は準備中です。</p>}
    </>
  );
}

/** レベルを選ぶ画面(初めて開いたときと、ヘッダーの「変更」から) */
function LevelPicker({ current, onPick, onCancel }: { current: LevelId | null; onPick: (id: LevelId) => void; onCancel?: () => void }) {
  return (
    <div className="app-shell">
      <div className="screen-body" style={{ paddingTop: 28 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.14em', color: 'var(--brand-red)', fontWeight: 700 }}>IELTS</div>
        <h1 style={{ margin: 0, fontSize: 30, color: 'var(--accent)' }}>目標のバンドを選ぶ</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          選んだレベルのモデルエッセイ・Reading・語彙・Speaking が並びます。あとから変えられます。
        </p>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '2px solid var(--text)' }}>
          {LEVELS.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => onPick(l.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 16,
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: l.id === current ? 'var(--accent-soft)' : 'none',
                  padding: '14px 8px',
                  textAlign: 'left',
                  color: 'var(--text)',
                }}
              >
                <span style={{ width: 86, flexShrink: 0, fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {l.band}
                </span>
                <span>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{l.name}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{l.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {onCancel && (
          <button className="secondary-btn" onClick={onCancel}>
            戻る
          </button>
        )}
      </div>
    </div>
  );
}
