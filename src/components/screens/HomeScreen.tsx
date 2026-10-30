import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntries } from '../../hooks/useEntries';
import { useAppData } from '../../context/AppDataContext';
import { joinTokens } from '../../lib/joinTokens';
import { formatRelativeDate } from '../../lib/relativeDate';
import { filterAndSortEntries, type SortMode } from '../../lib/homeListView';
import { getChunkTopics, getIdiomaticTopics, getPresetTopics, getTask1Topics, getToeflTopics } from '../../lib/presetLibrary';
import { presetEntriesToAdd, presetEntriesToRefresh, type PresetTopic } from '../../lib/presets';
import {
  CHUNK_DECK_ID,
  deckIdOf,
  IDIOMATIC_DECK_ID,
  loadSelectedDeckId,
  saveSelectedDeckId,
  TASK1_DECK_ID,
  TASK2_DECK_ID,
  TOEFL_DECK_ID,
} from '../../lib/decks';
import { useDecks } from '../../hooks/useDecks';
import type { Deck } from '../../types';
import { HAS_PRESETS, IS_EVERYONE, IS_PERSONAL } from '../../lib/target';
import type { SyncStatus } from '../../lib/cloudSync';
import { Fab } from '../common/Fab';
import { EmptyState } from '../common/EmptyState';
import { TaskPromptList } from '../common/TaskPromptList';
import { GearIcon, PencilIcon } from '../common/icons';

const SORT_LABEL: Record<SortMode, string> = {
  registered: '登録順',
  lastStudied: '最近学習した順',
};

export function HomeScreen() {
  const navigate = useNavigate();
  const { entries } = useEntries();
  const { data, dispatch, syncStatus } = useAppData();
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('registered');
  const { enabled: decksEnabled, decks, setDecks } = useDecks();
  const [selectedDeck, setSelectedDeck] = useState(loadSelectedDeckId);
  const [editingDecks, setEditingDecks] = useState(false);
  const currentDeck = decks.find((d) => d.id === selectedDeck)?.id ?? decks[0]!.id;
  const selectDeck = (deckId: string) => {
    setSelectedDeck(deckId);
    saveSelectedDeckId(deckId);
  };
  const deckEntries = useMemo(
    () => (decksEnabled ? entries.filter((e) => deckIdOf(e, decks) === currentDeck) : entries),
    [decksEnabled, entries, decks, currentDeck],
  );

  // いちばん最近学習した英文に「前回」の印を付け、続きから始められるようにする
  const previousId = useMemo(() => {
    const latest = data.sessions.reduce<{ entryId: string; timestamp: string } | null>(
      (best, s) => (!best || s.timestamp > best.timestamp ? s : best),
      null,
    );
    return latest?.entryId ?? null;
  }, [data.sessions]);

  const rows = useMemo(
    () => filterAndSortEntries(deckEntries, data.sessions, query, sortMode),
    [deckEntries, data.sessions, query, sortMode],
  );

  // 内蔵の教材ライブラリは自分専用版とみんな向けの IELTS 版だけに出す。Task 2 と Task 1 はそれぞれのタブで追加する
  const library = HAS_PRESETS ? libraryFor(currentDeck) : null;
  const presetTopics = library?.topics ?? [];
  const addedPresetIds = new Set(entries.map((e) => e.presetId).filter(Boolean));
  const missingPresets = presetTopics.filter((t) => !addedPresetIds.has(t.presetId)).length;
  const addPresets = () =>
    dispatch({ type: 'ADD_ENTRIES', ...presetEntriesToAdd(presetTopics, entries, new Date(), currentDeck) });
  const libraryCard = library && missingPresets > 0 && (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600 }}>教材ライブラリ</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
          {missingPresets === presetTopics.length ? library.description(presetTopics.length) : `未追加の題材が ${missingPresets}本あります`}
        </div>
      </div>
      <button className="primary-btn" style={{ padding: '9px 16px', fontSize: 13.5, flexShrink: 0 }} onClick={addPresets}>
        まとめて追加
      </button>
    </div>
  );

  // 内蔵題材の本文を書き換えたら、追加済みの英文を差し替えられるようにする
  const refresh = useMemo(() => presetEntriesToRefresh(presetTopics, entries), [presetTopics, entries]);
  const refreshCard = refresh.entries.length > 0 && (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
        <div style={{ fontWeight: 600 }}>題材の本文が新しくなりました({refresh.entries.length}本)</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
          更新すると、その題材の固定・除外とマーキングの変更は元に戻ります
        </div>
      </div>
      <button
        className="primary-btn"
        style={{ padding: '9px 16px', fontSize: 13.5, flexShrink: 0 }}
        onClick={() => dispatch({ type: 'REPLACE_ENTRIES', ...refresh })}
      >
        更新
      </button>
    </div>
  );

  // 公開版は内蔵の題材が無い代わりに、TOEFL の問題(固定)を最初から並べておく
  const promptList = !HAS_PRESETS && (
    <>
      <TaskPromptList entries={entries} />
      {deckEntries.length > 0 && <div className="section-label" style={{ marginTop: 6 }}>登録した英文</div>}
    </>
  );

  // iPhone でホーム画面に追加したアプリは Safari と保存場所が別なので、空のときは引き継ぎ方を案内する
  const transferHint = !IS_PERSONAL && entries.length === 0 && isHomeScreenApp() && (
    <div className="card" style={{ fontSize: 13, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 600 }}>Safari で登録した英文を移すには</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
        ホーム画面のアプリは、Safari とは別の場所に保存します(Safari の英文は消えていません)。
        Safari でこのページを開き、右上の歯車 →「引き継ぎ用にコピー」。次にこのアプリで、歯車 →「貼り付けて引き継ぐ」を押してください。
      </div>
    </div>
  );

  return (
    <div className="app-shell" style={{ position: 'relative' }}>
      <div className="topbar">
        <div className="topbar-title">{import.meta.env.VITE_APP_TITLE}</div>
        {IS_PERSONAL && <SyncBadge status={syncStatus} />}
        <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => navigate('/settings')} aria-label="設定">
          <GearIcon />
        </button>
      </div>

      {decksEnabled &&
        (editingDecks ? (
          <DeckEditor
            decks={decks}
            countOf={(deckId) => entries.filter((e) => deckIdOf(e, decks) === deckId).length}
            onSave={(next) => {
              setDecks(next);
              setEditingDecks(false);
            }}
            onCancel={() => setEditingDecks(false)}
          />
        ) : (
          <DeckTabs decks={decks} current={currentDeck} onSelect={selectDeck} onEdit={() => setEditingDecks(true)} />
        ))}

      {deckEntries.length === 0 && promptList ? (
        <div className="screen-body" style={{ paddingBottom: 100 }}>
          {transferHint}
          {promptList}
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            問題を選んで英文を登録しましょう。
            <br />
            問題に関係ない英文は、右下のボタンから登録できます。
          </div>
        </div>
      ) : deckEntries.length === 0 ? (
        <>
          <div className="screen-body" style={{ flex: 'none', paddingBottom: 0 }}>
            {transferHint}
            {libraryCard}
          </div>
          <EmptyState
            message={'まだ英文が登録されていません。\n右下のボタンから最初の英文を登録しましょう。'}
          />
        </>
      ) : (
        <div className="screen-body" style={{ paddingBottom: 100 }}>
          {refreshCard}
          {libraryCard}
          {promptList}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="タイトル・本文を検索"
              style={{
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '9px 14px',
                fontSize: 14,
                color: 'var(--text)',
              }}
            />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '9px 10px',
                fontSize: 13,
                color: 'var(--text)',
              }}
            >
              {(Object.keys(SORT_LABEL) as SortMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  {SORT_LABEL[mode]}
                </option>
              ))}
            </select>
          </div>

          {rows.length === 0 ? (
            <EmptyState message={`「${query}」に一致する英文はありません`} />
          ) : (
            rows.map(({ entry, lastStudied }) => {
              const preview = joinTokens(entry.tokens.slice(0, 24));
              return (
                <div
                  key={entry.id}
                  className="card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/entries/${entry.id}`)}
                  style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {entry.title && (
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>{entry.title}</div>
                  )}
                  <div
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 15,
                      lineHeight: 1.55,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {preview}
                    {entry.tokens.length > 24 ? '...' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
                    <span>{entry.tokens.filter((t) => /[A-Za-z0-9]/.test(t)).length}語</span>
                    <span>{lastStudied ? `前回学習: ${formatRelativeDate(lastStudied)}` : '未学習'}</span>
                    {entry.id === previousId && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: 'var(--pin-text)',
                          background: 'var(--pin-soft)',
                          borderRadius: 999,
                          padding: '2px 9px',
                        }}
                      >
                        前回ここ
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Fab onClick={() => navigate('/new')} />
    </div>
  );
}

/** ホーム画面に追加したアプリとして開いているか(iPhone の Safari では navigator.standalone) */
function isHomeScreenApp(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const SYNC_LABEL: Record<SyncStatus, { text: string; color: string }> = {
  connecting: { text: '同期中…', color: 'var(--text-muted)' },
  synced: { text: '同期オン', color: 'var(--success)' },
  offline: { text: 'この端末のみ', color: 'var(--text-muted)' },
  error: { text: '同期エラー', color: 'var(--danger)' },
};

/** 自分専用版の、端末間同期の状態 */
function SyncBadge({ status }: { status: SyncStatus }) {
  const { text, color } = SYNC_LABEL[status];
  return (
    <span style={{ fontSize: 11.5, color, border: `1px solid ${color}`, borderRadius: 999, padding: '1px 8px', marginLeft: 8 }}>
      {text}
    </span>
  );
}

interface Library {
  topics: PresetTopic[];
  description: (count: number) => string;
}

/** タブごとの内蔵の教材ライブラリ */
function libraryFor(deckId: string): Library | null {
  if (deckId === TASK2_DECK_ID)
    return {
      topics: getPresetTopics(),
      description: (n) =>
        IS_EVERYONE
          ? `バンド6.0〜6.5のモデルエッセイ ${n}本を追加できます(使える表現はマーキング済み)`
          : `エッセイ題材 ${n}本を追加できます(Idiomatic 300 の表現はマーキング済み)`,
    };
  if (deckId === TASK1_DECK_ID)
    return {
      topics: getTask1Topics(),
      description: (n) =>
        `図つきの${IS_EVERYONE ? 'バンド6.0〜6.5の' : ''}モデルアンサー ${n}本を追加できます(増減・比較の表現はマーキング済み)`,
    };
  if (deckId === TOEFL_DECK_ID)
    return {
      topics: getToeflTopics(),
      description: (n) => `問題文つきのメール ${n}本を追加できます(使える表現はマーキング済み)`,
    };
  if (deckId === CHUNK_DECK_ID)
    return {
      topics: getChunkTopics(),
      description: (n) => `${n}日分(1日17ブロック・${n}日で1周)を追加できます(イディオムと句動詞はマーキング済み・全文和訳つき)`,
    };
  if (deckId === IDIOMATIC_DECK_ID)
    return {
      topics: getIdiomaticTopics(),
      description: (n) => `${n}日分(1日10文)を追加できます(言い回し・コロケーションはマーキング済み)`,
    };
  return null;
}

/** 自分専用版のタブ。英文を種類ごとに分ける */
function DeckTabs({
  decks,
  current,
  onSelect,
  onEdit,
}: {
  decks: Deck[];
  current: string;
  onSelect: (deckId: string) => void;
  onEdit: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 20px 10px', flexShrink: 0 }}>
      <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
        {decks.map((deck) => {
          const active = deck.id === current;
          return (
            <button
              key={deck.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(deck.id)}
              style={{
                flexShrink: 0,
                border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--text-muted)',
                borderRadius: 999,
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {deck.name}
            </button>
          );
        })}
      </div>
      <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={onEdit} aria-label="タブを編集">
        <PencilIcon />
      </button>
    </div>
  );
}

/** タブの名前の変更・追加・削除(英文が入っているタブは消せない) */
function DeckEditor({
  decks,
  countOf,
  onSave,
  onCancel,
}: {
  decks: Deck[];
  countOf: (deckId: string) => number;
  onSave: (decks: Deck[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(decks);
  const inputStyle = {
    flex: 1,
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 14,
    color: 'var(--text)',
  };
  const save = () => onSave(draft.map((d, i) => ({ ...d, name: d.name.trim() || `タブ${i + 1}` })));

  return (
    <div className="card" style={{ margin: '0 20px 10px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>タブを編集</div>
      {draft.map((deck, i) => {
        const count = countOf(deck.id);
        return (
          <div key={deck.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={deck.name}
              aria-label={`タブ${i + 1}の名前`}
              onChange={(e) => setDraft(draft.map((d) => (d.id === deck.id ? { ...d, name: e.target.value } : d)))}
              style={inputStyle}
            />
            <button
              className="secondary-btn"
              style={{ padding: '7px 10px', fontSize: 12.5 }}
              disabled={count > 0 || draft.length <= 1}
              title={count > 0 ? `英文が${count}本入っているので削除できません` : undefined}
              onClick={() => setDraft(draft.filter((d) => d.id !== deck.id))}
            >
              削除
            </button>
          </div>
        );
      })}
      <button
        className="secondary-btn"
        style={{ padding: '8px', fontSize: 13 }}
        onClick={() => setDraft([...draft, { id: crypto.randomUUID(), name: `タブ${draft.length + 1}` }])}
      >
        ＋ タブを追加
      </button>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>英文が入っているタブは削除できません。</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="secondary-btn" style={{ flex: 1, padding: '9px' }} onClick={onCancel}>
          キャンセル
        </button>
        <button className="primary-btn" style={{ flex: 1, padding: '9px' }} onClick={save}>
          保存
        </button>
      </div>
    </div>
  );
}
