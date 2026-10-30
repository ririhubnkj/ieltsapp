import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useMarkings } from '../../hooks/useMarkings';
import { useRequireEntry } from '../../hooks/useRequireEntry';
import { useSessions } from '../../hooks/useSessions';
import { useSettings } from '../../hooks/useSettings';
import { adjacentEntries } from '../../lib/adjacentEntries';
import { blankCandidates, blankCount, pickBlanks } from '../../lib/quizSelection';
import { buildQuizPieces } from '../../lib/quizPieces';
import { isWordToken } from '../../lib/tokenize';
import { BackButton } from '../common/BackButton';
import { EntrySwitcher } from '../common/EntrySwitcher';
import { WordToken, type WordTokenVariant } from '../common/WordToken';
import { HAS_PRESETS } from '../../lib/target';
import { getAllPresetTopics, getAllPresetTranslations, entryLineBreaks, entryFigure, entryPrompt, skipsTemplates } from '../../lib/presetLibrary';
import { TaskPromptCard } from '../common/TaskPromptCard';
import { ParagraphBreak } from '../common/ParagraphBreak';
import { useDecks } from '../../hooks/useDecks';
import { TaskFigure } from '../common/TaskFigure';
import { buildEntryTranslation } from '../../lib/translation';

/** この時間だけ学習画面を開いていたら「学習した」と記録する */
const STUDY_RECORD_MS = 60_000;

export function QuizScreen() {
  const { id } = useParams<{ id: string }>();
  // 題材を切り替えたら穴・表示状態をリセットする
  return <QuizSession key={id} />;
}

function QuizSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, dispatch } = useAppData();
  const entry = useRequireEntry(id);
  const { ranges } = useMarkings(id ?? '');
  const { settings, quizMode, showGlossHints, setShowGlossHints } = useSettings();
  const { addSession } = useSessions(id ?? '');
  const { sameDeck } = useDecks();

  const drawBlanks = () =>
    entry
      ? pickBlanks(
          blankCandidates(entry.tokens, ranges, quizMode, settings.quizRatio, {
            pinned: entry.pinned,
            excluded: entry.excluded,
            skipTemplates: HAS_PRESETS && skipsTemplates(entry),
          }),
          entry.pinned ?? [],
          settings.quizRatio,
        )
      : [];

  const [blanks, setBlanks] = useState(drawBlanks);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // 内蔵題材(自分専用版)だけ、全文和訳を英文に対応づけて出せる
  const translation = useMemo(
    () => (HAS_PRESETS && entry ? buildEntryTranslation(entry, getAllPresetTopics(), getAllPresetTranslations()) : null),
    [entry],
  );

  // 一定時間この画面にいたら学習した扱いにする(1回の表示につき1回だけ)
  const totalRef = useRef(blanks.length);
  totalRef.current = blanks.length;
  useEffect(() => {
    const timer = setTimeout(() => addSession(totalRef.current), STUDY_RECORD_MS);
    return () => clearTimeout(timer);
  }, [addSession]);

  useEffect(() => {
    if (entry && blanks.length === 0) {
      navigate(`/entries/${id}`, { replace: true });
    }
  }, [entry, blanks.length, id, navigate]);

  if (!entry || blanks.length === 0) return null;

  const breaks = entryLineBreaks(entry);
  const pinned = new Set(entry.pinned ?? []);
  const excluded = new Set(entry.excluded ?? []);
  const pieces = buildQuizPieces(entry.tokens, blanks);
  const total = blanks.length;
  const pinnedInBlanks = blanks.filter((r) => pinned.has(r.start)).length;
  const allRevealed = revealed.size === total;
  const showJp = !!translation && showGlossHints;
  const sentenceAt = new Map(translation?.sentenceEnds.map((end, s) => [end, s]) ?? []);
  // 今の穴が含まれる表現は、和訳の対応部分を強調する
  const blankExprs = new Set(blanks.flatMap((r) => {
    const e = translation?.exprOfToken.get(r.start);
    return e === undefined ? [] : [e];
  }));
  const jpLine = (tokenIndex: number) => {
    const s = sentenceAt.get(tokenIndex);
    if (!showJp || s === undefined) return null;
    return (
      <span
        style={{
          display: 'block',
          fontFamily: 'var(--font-ui)',
          fontSize: 12.5,
          lineHeight: 1.7,
          color: 'var(--text-muted)',
          margin: '0 0 10px',
        }}
      >
        {translation!.sentences[s]!.map((seg, k) =>
          seg.expr !== undefined && blankExprs.has(seg.expr) ? (
            <mark
              key={k}
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600, borderRadius: 3, padding: '0 2px' }}
            >
              {seg.text}
            </mark>
          ) : (
            <Fragment key={k}>{seg.text}</Fragment>
          ),
        )}
      </span>
    );
  };

  const handleTap = (tokenIndex: number) => {
    setActiveIndex(tokenIndex);
    if (!revealed.has(tokenIndex)) {
      setRevealed((prev) => new Set(prev).add(tokenIndex));
      return;
    }
    dispatch({ type: 'TOGGLE_PIN', entryId: entry.id, index: tokenIndex });
  };

  // 穴になっていない語をタップしたら、その場で固定の穴にする
  const addPinnedBlank = (tokenIndex: number) => {
    dispatch({ type: 'TOGGLE_PIN', entryId: entry.id, index: tokenIndex });
    setBlanks((prev) => [...prev, { start: tokenIndex, end: tokenIndex }].sort((a, b) => a.start - b.start));
    setActiveIndex(tokenIndex);
  };

  // 除外した語は今の出題からも外す
  const toggleExclude = (tokenIndex: number) => {
    dispatch({ type: 'TOGGLE_EXCLUDE', entryId: entry.id, index: tokenIndex });
    if (!excluded.has(tokenIndex)) {
      setBlanks((prev) => prev.filter((r) => r.start !== tokenIndex));
      setRevealed((prev) => {
        const next = new Set(prev);
        next.delete(tokenIndex);
        return next;
      });
      setActiveIndex(null);
    }
  };

  const toggleRevealAll = () => {
    setRevealed(allRevealed ? new Set() : new Set(blanks.map((r) => r.start)));
    setActiveIndex(null);
  };

  const handleRedraw = () => {
    setBlanks(drawBlanks());
    setRevealed(new Set());
    setActiveIndex(null);
  };

  // 現在の出題設定で穴を作れる題材だけを移動先にする
  const figure = entryFigure(entry);
  const prompt = entryPrompt(entry);
  // 自分専用版はどの題材も本文を広く取るため、タイトル行と操作バーを最小限にする
  const compact = HAS_PRESETS;
  const playable = sameDeck(data.entries, entry).filter((e) => {
    if (e.id === entry.id) return true;
    const entryRanges = data.markings.find((m) => m.entryId === e.id)?.ranges ?? [];
    const pinnedOf = e.pinned ?? [];
    return (
      blankCount(
        blankCandidates(e.tokens, entryRanges, quizMode, settings.quizRatio, {
          pinned: pinnedOf,
          excluded: e.excluded,
          skipTemplates: HAS_PRESETS && skipsTemplates(e),
        }),
        pinnedOf,
        settings.quizRatio,
      ) > 0
    );
  });
  const adjacent = adjacentEntries(playable, entry.id);

  const moveTo = (targetId: string) => {
    navigate(`/entries/${targetId}/quiz`, { replace: true });
  };

  const handleFinish = () => {
    navigate(`/entries/${id}`, { replace: true });
  };

  return (
    <div className="app-shell app-shell--viewport">
      <div className="topbar">
        <BackButton to={`/entries/${id}`} />
        <div className="topbar-title" style={{ fontSize: 16 }}>
          穴 {total}箇所
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--pin-text)', marginLeft: 8 }}>
            固定 {pinnedInBlanks}
          </span>
        </div>
        {translation && (
        <button
          onClick={() => setShowGlossHints(!showGlossHints)}
          aria-pressed={showGlossHints}
          style={{
            background: showGlossHints ? 'var(--accent-soft)' : 'none',
            border: '1.5px solid ' + (showGlossHints ? 'var(--accent)' : 'var(--border)'),
            color: showGlossHints ? 'var(--accent)' : 'var(--text-muted)',
            borderRadius: 999,
            padding: '5px 12px',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          和訳 {showGlossHints ? 'ON' : 'OFF'}
        </button>
        )}
      </div>
      {figure && <TaskFigure src={figure} />}
      {prompt && <TaskPromptCard prompt={prompt} />}
      <EntrySwitcher {...adjacent} onMove={(e) => moveTo(e.id)} compactTitle={compact ? (entry.title ?? '') : undefined} />
      {entry.title && !compact && (
        <div style={{ margin: '-4px 20px 10px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{entry.title}</div>
      )}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, margin: compact ? '0 20px 6px' : '0 20px 14px', flexShrink: 0 }}>
        <div
          style={{
            height: '100%',
            width: `${(revealed.size / total) * 100}%`,
            background: 'var(--accent)',
            borderRadius: 2,
            transition: 'width 0.2s',
          }}
        />
      </div>

      <div className="screen-body" style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 2.2 }}>
          {pieces.map((piece, i) => {
            const leadsWithWord = piece.type === 'blank' ? true : piece.leadsWithWord;
            const space = i > 0 && leadsWithWord ? ' ' : '';
            if (piece.type === 'text') {
              return (
                <Fragment key={i}>
                  {space}
                  {entry.tokens.slice(piece.start, piece.end + 1).map((token, k) => {
                    const tokenIndex = piece.start + k;
                    const gap = k > 0 && isWordToken(token) ? ' ' : '';
                    if (!isWordToken(token))
                      return (
                        <Fragment key={tokenIndex}>
                          {gap}
                          {token}
                          {jpLine(tokenIndex)}
                          {breaks.has(tokenIndex) && <ParagraphBreak paragraph={breaks.get(tokenIndex)} />}
                        </Fragment>
                      );
                    return (
                      <Fragment key={tokenIndex}>
                        {gap}
                        <WordToken
                          variant={excluded.has(tokenIndex) ? 'excluded' : 'normal'}
                          onClick={() => addPinnedBlank(tokenIndex)}
                          paddingLeft={0}
                          paddingRight={0}
                        >
                          {token}
                        </WordToken>
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            }
            const tokenIndex = blanks[piece.rangeIndex]!.start;
            const isRevealed = revealed.has(tokenIndex);
            const isPinned = pinned.has(tokenIndex);
            const variant: WordTokenVariant = isRevealed
              ? isPinned
                ? 'revealedPinned'
                : 'revealedPending'
              : isPinned
                ? 'blankPinned'
                : 'blankHidden';
            const token = (
              <WordToken variant={variant} onClick={() => handleTap(tokenIndex)}>
                {isRevealed ? piece.label : ''}
              </WordToken>
            );
            return (
              <Fragment key={i}>
                {space}
                {token}
              </Fragment>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: compact ? '10px 14px 14px' : '14px 18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {activeIndex !== null && revealed.has(activeIndex) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="secondary-btn"
                style={{ flex: 1, padding: '8px 6px', fontSize: 12.5 }}
                onClick={() => dispatch({ type: 'TOGGLE_PIN', entryId: entry.id, index: activeIndex })}
              >
                {pinned.has(activeIndex) ? '固定を解除' : 'この穴を固定'}
              </button>
              <button
                className="secondary-btn"
                style={{ flex: 1, padding: '8px 6px', fontSize: 12.5 }}
                onClick={() => toggleExclude(activeIndex)}
              >
                もう出題しない
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: pinned.has(activeIndex) ? 'var(--pin-text)' : 'var(--text-muted)' }}>
              {pinned.has(activeIndex)
                ? '固定中: 割合を変えても毎回穴になります(もう一度タップで解除)'
                : '「もう出題しない」にすると、この語は自動の穴埋めから外れます'}
            </div>
          </div>
        ) : compact ? null : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            好きな空欄をタップして答えを表示。
            <br />
            間違えた・覚えたい穴はもう一度タップで固定。
            <br />
            穴以外の語をタップすると、その語も固定の穴にできます。
            <br />
            出題したくない語は、表示してから「もう出題しない」。
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary-btn" style={{ flex: 1, padding: compact ? '8px 6px' : '11px 6px', fontSize: 13.5 }} onClick={toggleRevealAll}>
            {allRevealed ? 'すべて隠す' : 'すべて表示'}
          </button>
          <button className="secondary-btn" style={{ flex: 1, padding: compact ? '8px 6px' : '11px 6px', fontSize: 13.5 }} onClick={handleRedraw}>
            穴を引き直す
          </button>
          <button className="primary-btn" style={{ flex: 1, padding: compact ? '8px 6px' : '11px 6px', fontSize: 13.5 }} onClick={handleFinish}>
            終了
          </button>
        </div>
      </div>
    </div>
  );
}
