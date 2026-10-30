import type { Entry } from '../../types';

interface EntrySwitcherProps {
  prev: Entry | null;
  next: Entry | null;
  position: number;
  total: number;
  onMove: (entry: Entry) => void;
  /** 図のある題材用。ボタンを矢印だけにし、間にタイトルを出して1行に収める */
  compactTitle?: string;
}

const navButtonStyle = (enabled: boolean): React.CSSProperties => ({
  background: 'none',
  border: '1.5px solid var(--border)',
  borderRadius: 999,
  padding: '5px 12px',
  fontSize: 12.5,
  fontWeight: 600,
  color: enabled ? 'var(--accent)' : 'var(--text-muted)',
  opacity: enabled ? 1 : 0.45,
  whiteSpace: 'nowrap',
});

/** 前後の題材へ移動するバー。出題設定(割合・対象)は共通なのでそのまま引き継がれる */
export function EntrySwitcher({ prev, next, position, total, onMove, compactTitle }: EntrySwitcherProps) {
  if (total <= 1 || position < 0) return null;
  if (compactTitle !== undefined)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 12px 6px', flexShrink: 0 }}>
        <button
          style={{ ...navButtonStyle(prev !== null), padding: '3px 11px' }}
          disabled={prev === null}
          onClick={() => prev && onMove(prev)}
          aria-label="前の題材"
        >
          ‹
        </button>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: 'center',
            fontSize: 12.5,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {compactTitle}
          <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>
            {position + 1}/{total}
          </span>
        </div>
        <button
          style={{ ...navButtonStyle(next !== null), padding: '3px 11px' }}
          disabled={next === null}
          onClick={() => next && onMove(next)}
          aria-label="次の題材"
        >
          ›
        </button>
      </div>
    );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 20px 12px' }}>
      <button
        style={navButtonStyle(prev !== null)}
        disabled={prev === null}
        onClick={() => prev && onMove(prev)}
        aria-label="前の題材"
      >
        ‹ 前の題材
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontSize: 12.5, color: 'var(--text-muted)' }}>
        {position + 1} / {total}
      </div>
      <button
        style={navButtonStyle(next !== null)}
        disabled={next === null}
        onClick={() => next && onMove(next)}
        aria-label="次の題材"
      >
        次の題材 ›
      </button>
    </div>
  );
}
