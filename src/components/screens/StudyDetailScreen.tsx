import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useEntries } from '../../hooks/useEntries';
import { useMarkings } from '../../hooks/useMarkings';
import { useRequireEntry } from '../../hooks/useRequireEntry';
import { useSessions } from '../../hooks/useSessions';
import { useSettings } from '../../hooks/useSettings';
import { joinTokens } from '../../lib/joinTokens';
import { formatRelativeDate } from '../../lib/relativeDate';
import { blankCandidates, blankCount, quizCandidates } from '../../lib/quizSelection';
import { lastStudiedAt } from '../../lib/stats';
import { adjacentEntries } from '../../lib/adjacentEntries';
import { BackButton } from '../common/BackButton';
import { EntrySwitcher } from '../common/EntrySwitcher';
import { RatioSlider } from '../common/RatioSlider';
import { FigureAttach } from '../common/FigureAttach';
import { TaskPromptPicker } from '../common/TaskPromptPicker';
import { PencilIcon } from '../common/icons';
import { HAS_PRESETS } from '../../lib/target';
import { skipsTemplates } from '../../lib/presetLibrary';
import { useDecks } from '../../hooks/useDecks';

export function StudyDetailScreen() {
  const { id } = useParams<{ id: string }>();
  return <StudyDetail key={id} />;
}

function StudyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const entry = useRequireEntry(id);
  const { entries, setEntryTitle, setEntryFigure, setEntryPrompt } = useEntries();
  const { dispatch } = useAppData();
  const { ranges } = useMarkings(id ?? '');
  const { sessions, studyCount } = useSessions(id ?? '');
  const { settings, quizMode, setQuizRatio, setQuizMode } = useSettings();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const { sameDeck } = useDecks();

  if (!entry) return null;

  const startEditingTitle = () => {
    setTitleDraft(entry.title ?? '');
    setEditingTitle(true);
  };

  const commitTitle = () => {
    setEntryTitle(entry.id, titleDraft);
    setEditingTitle(false);
  };

  const wordCount = entry.tokens.filter((t) => /[A-Za-z0-9]/.test(t)).length;
  const candidates = blankCandidates(entry.tokens, ranges, quizMode, settings.quizRatio, {
    pinned: entry.pinned,
    excluded: entry.excluded,
    skipTemplates: HAS_PRESETS && skipsTemplates(entry),
  });
  const markedWordCount = quizCandidates(entry.tokens, ranges, 'marked').length;
  const pinnedCount = entry.pinned?.length ?? 0;
  const excludedCount = entry.excluded?.length ?? 0;
  const estimated = blankCount(candidates, entry.pinned ?? [], settings.quizRatio);
  const needsMarking = estimated === 0;
  const pinnedNote = pinnedCount > 0 ? `(固定${pinnedCount}語を含む)` : '';

  return (
    <div className="app-shell">
      <div className="topbar">
        <BackButton to="/" />
        <div className="topbar-title">学習を始める</div>
      </div>
      <EntrySwitcher
        {...adjacentEntries(sameDeck(entries, entry), entry.id)}
        onMove={(e) => navigate(`/entries/${e.id}`, { replace: true })}
      />
      <div className="screen-body">
        <div className="card">
          {editingTitle ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                autoFocus
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitTitle()}
                placeholder="タイトルを入力"
                style={{
                  flex: 1,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 14,
                  color: 'var(--text)',
                }}
              />
              <button className="secondary-btn" style={{ padding: '6px 14px' }} onClick={commitTitle}>
                保存
              </button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={startEditingTitle}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 600, color: entry.title ? 'var(--text)' : 'var(--text-muted)' }}>
                {entry.title || 'タイトルを追加'}
              </span>
              <PencilIcon />
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.6 }}>
            {joinTokens(entry.tokens.slice(0, 28))}
            {entry.tokens.length > 28 ? '...' : ''}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>
            <span>{wordCount}語</span>
            <span>マーキング {markedWordCount}語</span>
            {pinnedCount > 0 && <span style={{ color: 'var(--pin-text)' }}>固定 {pinnedCount}語</span>}
            {excludedCount > 0 && <span>除外 {excludedCount}語</span>}
            <span>最終学習: {formatRelativeDate(lastStudiedAt(sessions))}</span>
          </div>
          {/* 内蔵の題材は図が決まっているので、自分で登録した題材だけ図を添付できる */}
          {!entry.presetId && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!HAS_PRESETS && <TaskPromptPicker promptId={entry.promptId} onChange={(p) => setEntryPrompt(entry.id, p)} />}
              <FigureAttach figure={entry.figure} onChange={(f) => setEntryFigure(entry.id, f)} />
            </div>
          )}
        </div>

        <div>
          <div className="section-label">出題設定(すべての英文に共通)</div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div role="radiogroup" aria-label="穴埋めの対象" style={{ display: 'flex', background: 'var(--bg)', borderRadius: 10, padding: 3 }}>
              {([
                ['marked', 'マーキングした単語'],
                ['allWords', '全単語からランダム'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={quizMode === mode}
                  onClick={() => setQuizMode(mode)}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: 8,
                    padding: '9px 6px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: quizMode === mode ? 'var(--surface)' : 'transparent',
                    color: quizMode === mode ? 'var(--accent)' : 'var(--text-muted)',
                    boxShadow: quizMode === mode ? '0 1px 3px rgba(28,36,48,0.12)' : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <RatioSlider
              ratio={settings.quizRatio}
              onChange={setQuizRatio}
              caption={estimated > 0 ? `${candidates.length}語中 ${estimated}語を穴埋め${pinnedNote}` : undefined}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {quizMode === 'allWords'
                ? '本文のすべての単語から、指定した割合をランダムに穴埋めにします。'
                : 'マーキングした単語のうち、指定した割合をランダムに穴埋めにします。'}
              {quizMode === 'allWords' &&
                settings.quizRatio < 1 &&
                '冠詞・be動詞・助動詞・前置詞・代名詞・接続詞・however などの接続副詞・often などの頻度の副詞は、自動では穴になりません(100%のときは対象)。'}
              ここで変更すると他の英文にも適用されます。
            </div>
          </div>
        </div>

        <button
          className="primary-btn"
          style={{ marginTop: 'auto' }}
          disabled={needsMarking}
          onClick={() => navigate(`/entries/${id}/quiz`)}
        >
          {needsMarking ? 'マーキングがありません' : '学習を始める'}
        </button>
        {needsMarking && (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
            先に単語をマーキングするか、「全単語からランダム」を選んでください
          </p>
        )}
        <button className="secondary-btn" onClick={() => navigate(`/entries/${id}/mark`)}>
          {ranges.length === 0 ? 'マーキングへ' : 'マーキングを編集'}
        </button>
        <button className="secondary-btn" onClick={() => navigate(`/entries/${id}/edit`)}>
          本文を編集
        </button>
        {excludedCount > 0 && (
          <button className="secondary-btn" onClick={() => dispatch({ type: 'CLEAR_EXCLUDED', entryId: entry.id })}>
            出題しない語をすべて戻す({excludedCount}語)
          </button>
        )}
        {pinnedCount > 0 && (
          <button className="secondary-btn" onClick={() => dispatch({ type: 'CLEAR_PINS', entryId: entry.id })}>
            固定した穴をすべて解除({pinnedCount}語)
          </button>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>学習回数 {studyCount}回</p>
      </div>
    </div>
  );
}
