import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useEntries } from '../../hooks/useEntries';
import { getAllPresetTopics } from '../../lib/presetLibrary';
import { presetEntriesToAdd } from '../../lib/presets';
import { TASK1_DECK_ID, TASK2_DECK_ID } from '../../lib/decks';
import { CRITERIA, splitTemplateLine, TEMPLATES, type WritingTask, type WritingTemplate } from '../../lib/writingTemplates';
import { TopBar } from '../common/TopBar';
import { BackButton } from '../common/BackButton';

/** IELTS Writing の型(Task 1 は4型、Task 2 は5型)と採点基準 */
export function TemplatesScreen() {
  const { task: param } = useParams<{ task: string }>();
  const task: WritingTask = param === 'task1' ? 'task1' : 'task2';
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(TEMPLATES[task][0]!.id);
  const [showCriteria, setShowCriteria] = useState(false);
  const { entries } = useEntries();
  const { dispatch } = useAppData();

  // 型のエッセイ例を穴埋めで練習する。まだ追加していなければ、その題材だけを追加してから開く
  const practise = (template: WritingTemplate) => {
    const existing = entries.find((e) => e.presetId === template.modelPresetId);
    if (existing) {
      navigate(`/entries/${existing.id}`);
      return;
    }
    const topic = getAllPresetTopics().find((t) => t.presetId === template.modelPresetId);
    if (!topic) return;
    const added = presetEntriesToAdd([topic], entries, new Date(), task === 'task1' ? TASK1_DECK_ID : TASK2_DECK_ID);
    dispatch({ type: 'ADD_ENTRIES', ...added });
    navigate(`/entries/${added.entries[0]!.id}`);
  };

  return (
    <div className="app-shell">
      <TopBar title={`${task === 'task1' ? 'Task 1' : 'Task 2'} の型`} left={<BackButton to="/" />} />
      <div className="screen-body">
        <div role="tablist" style={{ display: 'flex', gap: 6 }}>
          {(['task2', 'task1'] as WritingTask[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === task}
              onClick={() => {
                setOpen(TEMPLATES[t][0]!.id);
                navigate(`/templates/${t}`, { replace: true });
              }}
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
              {t === 'task1' ? 'Task 1(図表)' : 'Task 2(エッセイ)'}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '12px 16px' }}>
          <button
            onClick={() => setShowCriteria(!showCriteria)}
            aria-expanded={showCriteria}
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
            採点基準(4項目・各25%)
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>{showCriteria ? '▲' : '▼'}</span>
          </button>
          {showCriteria && (
            <ol style={{ margin: '10px 0 0', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CRITERIA[task].map((c) => (
                <li key={c.name} style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <b>{c.name}</b>({c.nameJa})
                  <div style={{ color: 'var(--text-muted)' }}>{c.description}</div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {TEMPLATES[task].map((template, i) => (
          <TemplateCard
            key={template.id}
            index={i + 1}
            template={template}
            open={open === template.id}
            onToggle={() => setOpen(open === template.id ? null : template.id)}
            added={entries.some((e) => e.presetId === template.modelPresetId)}
            onPractise={() => practise(template)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  index,
  template,
  open,
  onToggle,
  added,
  onPractise,
}: {
  index: number;
  template: WritingTemplate;
  open: boolean;
  onToggle: () => void;
  added: boolean;
  onPractise: () => void;
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, border: 'none', background: 'none', padding: 0, textAlign: 'left' }}
      >
        <span
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            borderRadius: 999,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: 12.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {index}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>{template.name}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{template.question}</span>
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <>
          {template.paragraphs.map((p) => (
            <div key={p.label} style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{p.label}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {p.lines.map((line) => (
                  <div key={line} style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, lineHeight: 1.6 }}>
                    {splitTemplateLine(line).map((part, i) =>
                      part.slot ? (
                        <span
                          key={i}
                          style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: 12.5,
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
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-muted)' }}>
            {template.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <button className="primary-btn" style={{ padding: 12, fontSize: 14 }} onClick={onPractise}>
            {added ? 'エッセイ例を穴埋めで練習する' : 'エッセイ例を追加して練習する'}
          </button>
        </>
      )}
    </div>
  );
}
