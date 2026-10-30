import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { dueItems, gradeReviewItem, loadReview, removeReviewItem, sentenceAround, stillMatches, type ReviewItem } from '../../lib/review';
import { getAllPresetTopics, getAllPresetTranslations } from '../../lib/presetLibrary';
import { buildEntryTranslation } from '../../lib/translation';
import { isWordToken } from '../../lib/tokenize';
import { logActivity } from '../../lib/activity';
import { speak, speechSupported } from '../../lib/speech';
import { joinTokens } from '../../lib/joinTokens';
import { TopBar } from '../common/TopBar';
import { BackButton } from '../common/BackButton';
import { EmptyState } from '../common/EmptyState';

/** 苦手の復習。期限の来た語を、1文ずつ穴埋めで出す */
export function ReviewScreen() {
  const navigate = useNavigate();
  const { data } = useAppData();
  // 開いたときの期限切れの語を順に出す(途中で増減しても並びは変えない)
  const [queue] = useState<ReviewItem[]>(() =>
    dueItems(loadReview()).filter((i) => {
      const entry = data.entries.find((e) => e.id === i.entryId);
      return entry && stillMatches(i, entry.tokens);
    }),
  );
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState({ ok: 0, again: 0 });
  const translations = useMemo(() => getAllPresetTranslations(), []);

  const item = queue[pos];
  const entry = item ? data.entries.find((e) => e.id === item.entryId) : undefined;

  if (queue.length === 0) {
    const total = loadReview().length;
    return (
      <div className="app-shell">
        <TopBar title="苦手の復習" left={<BackButton to="/" />} />
        <EmptyState
          message={
            total > 0
              ? `今日復習する語はありません。\n次の復習を待っている語が ${total}語あります。`
              : '復習する語はまだありません。\n穴埋めで答えを見たあと、もう一度タップして固定した語がここに入ります。'
          }
        />
      </div>
    );
  }

  if (!item || !entry) {
    return (
      <div className="app-shell">
        <TopBar title="苦手の復習" left={<BackButton to="/" />} />
        <div className="screen-body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 15, lineHeight: 1.8 }}>
            今日の復習は終わりです。
            <br />
            覚えていた {results.ok}語・まだ {results.again}語
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>「まだ」の語は明日もう一度出ます。</div>
          <button className="primary-btn" style={{ width: '100%' }} onClick={() => navigate('/')}>
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  const { start, end, sentence } = sentenceAround(entry.tokens, item.index);
  const translation = buildEntryTranslation(entry, getAllPresetTopics(), translations);
  const jp = translation?.sentences[sentence];
  const expr = translation?.exprOfToken.get(item.index);

  const grade = (remembered: boolean) => {
    gradeReviewItem(item.id, remembered);
    setResults((r) => (remembered ? { ...r, ok: r.ok + 1 } : { ...r, again: r.again + 1 }));
    if (pos === queue.length - 1) logActivity({ kind: 'review', title: '苦手の復習', score: results.ok + (remembered ? 1 : 0), total: queue.length });
    setRevealed(false);
    setPos(pos + 1);
  };

  return (
    <div className="app-shell app-shell--viewport">
      <TopBar
        title="苦手の復習"
        left={<BackButton to="/" />}
        right={
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {pos + 1} / {queue.length}
          </span>
        }
      />
      <div className="screen-body">
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{entry.title}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, lineHeight: 1.9 }}>
          {entry.tokens.slice(start, end + 1).map((t, k) => {
            const i = start + k;
            const gap = k > 0 && isWordToken(t) ? ' ' : '';
            if (i !== item.index) return <Fragment key={i}>{gap}{t}</Fragment>;
            return (
              <Fragment key={i}>
                {gap}
                <button
                  onClick={() => setRevealed(true)}
                  style={{
                    font: 'inherit',
                    minWidth: 80,
                    border: 'none',
                    borderBottom: '2px solid var(--accent)',
                    background: revealed ? 'var(--accent-soft)' : 'transparent',
                    color: 'var(--accent)',
                    padding: '0 4px',
                  }}
                  aria-label={revealed ? t : '答えを表示'}
                >
                  {revealed ? t : ' '}
                </button>
              </Fragment>
            );
          })}
        </div>
        {jp && (
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-muted)' }}>
            {jp.map((seg, k) =>
              seg.expr !== undefined && seg.expr === expr ? (
                <mark key={k} style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>
                  {seg.text}
                </mark>
              ) : (
                <Fragment key={k}>{seg.text}</Fragment>
              ),
            )}
          </div>
        )}
        {speechSupported() && (
          <button
            className="secondary-btn"
            style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: 13 }}
            onClick={() => speak([joinTokens(entry.tokens.slice(start, end + 1))], { rate: data.settings.speechRate ?? 1 })}
          >
            文を読み上げる
          </button>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {revealed ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="secondary-btn" style={{ flex: 1 }} onClick={() => grade(false)}>
                まだ
              </button>
              <button className="primary-btn" style={{ flex: 1 }} onClick={() => grade(true)}>
                覚えていた
              </button>
            </div>
          ) : (
            <button className="primary-btn" onClick={() => setRevealed(true)}>
              答えを見る
            </button>
          )}
          <button
            onClick={() => {
              removeReviewItem(item.id);
              setRevealed(false);
              setPos(pos + 1);
            }}
            style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: 12.5, padding: 6 }}
          >
            この語は復習から外す
          </button>
        </div>
      </div>
    </div>
  );
}
