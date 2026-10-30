import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMarkings } from '../../hooks/useMarkings';
import { useRequireEntry } from '../../hooks/useRequireEntry';
import { isMarked, toggleWordMarking } from '../../lib/markingLogic';
import { expandToWordRanges } from '../../lib/quizSelection';
import { MarkingParagraph } from '../common/MarkingParagraph';
import { BackButton } from '../common/BackButton';
import { TaskFigure } from '../common/TaskFigure';
import { entryLineBreaks, entryFigure, entryPrompt } from '../../lib/presetLibrary';
import { TaskPromptCard } from '../common/TaskPromptCard';

export function MarkingScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lastTapped, setLastTapped] = useState<number | null>(null);

  const entry = useRequireEntry(id);
  const { ranges, setRanges } = useMarkings(id ?? '');
  const activeIndex = lastTapped !== null && isMarked(ranges, lastTapped) ? lastTapped : null;

  if (!entry) return null;

  const figure = entryFigure(entry);
  const prompt = entryPrompt(entry);
  const markedWordCount = expandToWordRanges(entry.tokens, ranges).length;

  const onTap = (index: number) => {
    setRanges(toggleWordMarking(ranges, index));
    setLastTapped(index);
  };

  return (
    <div className="app-shell app-shell--viewport">
      <div className="topbar">
        <BackButton to="/" />
        <div className="topbar-title" style={{ flex: 1 }}>穴埋めにする単語を選択</div>
        <button
          onClick={() => navigate('/', { replace: true })}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14.5, fontWeight: 600, padding: '8px 4px' }}
        >
          完了
        </button>
      </div>
      {figure && <TaskFigure src={figure} />}
      {prompt && <TaskPromptCard prompt={prompt} />}

      <div className="screen-body" style={{ flex: 1 }}>
        <MarkingParagraph
          tokens={entry.tokens}
          ranges={ranges}
          activeIndex={activeIndex}
          onTap={onTap}
          lineBreaks={entryLineBreaks(entry)}
        />
      </div>

      <div
        style={{
          flexShrink: 0,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '14px 20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accent)' }}>{markedWordCount}語 選択中</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          タップした単語が1語ずつ穴埋めの対象になります。もう一度タップすると解除されます。
        </div>
      </div>
    </div>
  );
}
