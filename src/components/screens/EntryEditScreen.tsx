import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useMarkings } from '../../hooks/useMarkings';
import { useRequireEntry } from '../../hooks/useRequireEntry';
import { editedEntry, entryText } from '../../lib/editEntry';
import { entryLineBreaks, restoredPresetEntry } from '../../lib/presetLibrary';
import { BackButton } from '../common/BackButton';
import { ConfirmDialog } from '../common/ConfirmDialog';

export function EntryEditScreen() {
  const { id } = useParams<{ id: string }>();
  return <EntryEdit key={id} />;
}

function EntryEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const entry = useRequireEntry(id);
  const { dispatch } = useAppData();
  const { ranges } = useMarkings(id ?? '');
  const original = useMemo(() => (entry ? entryText(entry.tokens, entryLineBreaks(entry)) : ''), [entry]);
  const [text, setText] = useState(original);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const restored = useMemo(() => (entry?.edited ? restoredPresetEntry(entry) : null), [entry]);

  if (!entry) return null;

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const back = () => navigate(`/entries/${entry.id}`, { replace: true });

  const handleSave = () => {
    if (!text.trim()) return;
    if (text !== original) {
      const next = editedEntry(entry, ranges, text);
      dispatch({ type: 'REPLACE_ENTRIES', entries: [next.entry], markings: [{ entryId: entry.id, ranges: next.ranges }] });
    }
    back();
  };

  const handleRestore = () => {
    if (!restored) return;
    dispatch({ type: 'REPLACE_ENTRIES', entries: [restored.entry], markings: [{ entryId: entry.id, ranges: restored.ranges }] });
    back();
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <BackButton to={`/entries/${entry.id}`} />
        <div className="topbar-title">本文を編集</div>
      </div>

      <div className="screen-body">
        {entry.title && <div style={{ fontSize: 14.5, fontWeight: 600 }}>{entry.title}</div>}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="英文"
          style={{
            width: '100%',
            minHeight: 360,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 16,
            fontFamily: 'var(--font-serif)',
            fontSize: 15,
            lineHeight: 1.65,
            color: 'var(--text)',
            resize: 'vertical',
          }}
        />
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{wordCount} words</div>
        <div style={{ background: 'var(--accent-soft)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#33506e', lineHeight: 1.5 }}>
          書き換えていない単語のマーキング・固定・除外はそのまま残ります。書き換えた・足した単語は、保存後に「マーキングを編集」で選び直してください。
          {entry.presetId && ' 内蔵の題材は、編集すると教材の更新で上書きされなくなります(全文和訳は、文の数が変わらなければそのまま付きます)。'}
        </div>
        <button className="primary-btn" style={{ marginTop: 'auto' }} disabled={!text.trim()} onClick={handleSave}>
          保存
        </button>
        {restored && (
          <button className="secondary-btn" onClick={() => setConfirmRestore(true)}>
            内蔵の元の本文に戻す
          </button>
        )}
      </div>

      {confirmRestore && (
        <ConfirmDialog
          title="元の本文に戻しますか？"
          body="編集した本文は消え、マーキングも内蔵の題材のものに戻ります。"
          detail="固定・除外した語も解除されます"
          confirmLabel="元に戻す"
          danger
          onConfirm={handleRestore}
          onCancel={() => setConfirmRestore(false)}
        />
      )}
    </div>
  );
}
