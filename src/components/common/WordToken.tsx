import type { ReactNode } from 'react';

export type WordTokenVariant =
  | 'normal'
  | 'marked'
  | 'markedActive'
  | 'blankHidden'
  | 'revealedPending'
  | 'blankPinned'
  | 'revealedPinned'
  | 'excluded';

const VARIANT_STYLE: Record<WordTokenVariant, React.CSSProperties> = {
  normal: {},
  marked: {
    background: 'var(--accent-soft)',
    boxShadow: 'inset 0 -2px 0 var(--accent)',
    color: '#2c4560',
    borderRadius: 5,
  },
  markedActive: {
    background: 'var(--accent-soft)',
    boxShadow: 'inset 0 -2px 0 var(--accent)',
    color: '#2c4560',
    outline: '2px solid var(--accent)',
    outlineOffset: 1,
    borderRadius: 5,
  },
  blankHidden: {
    display: 'inline-block',
    minWidth: 64,
    height: 20,
    borderBottom: '2px solid var(--accent)',
    verticalAlign: 'middle',
  },
  revealedPending: {
    color: 'var(--accent)',
    fontWeight: 600,
    borderBottom: '2px solid var(--accent)',
    padding: '0 2px',
  },
  blankPinned: {
    display: 'inline-block',
    minWidth: 64,
    height: 20,
    borderBottom: '2px solid var(--pin)',
    background: 'var(--pin-soft)',
    borderRadius: '5px 5px 0 0',
    verticalAlign: 'middle',
  },
  excluded: {
    color: 'var(--text-muted)',
    borderBottom: '1px dotted var(--text-muted)',
  },
  revealedPinned: {
    color: 'var(--pin-text)',
    fontWeight: 600,
    borderBottom: '2px solid var(--pin)',
    background: 'var(--pin-soft)',
    borderRadius: 5,
    padding: '0 4px',
  },
};

interface WordTokenProps {
  children?: ReactNode;
  variant?: WordTokenVariant;
  onClick?: () => void;
  paddingLeft?: number;
  paddingRight?: number;
}

export function WordToken({ children, variant = 'normal', onClick, paddingLeft = 3, paddingRight = 3 }: WordTokenProps) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        padding: `1px ${paddingRight}px 1px ${paddingLeft}px`,
        cursor: onClick ? 'pointer' : undefined,
        ...VARIANT_STYLE[variant],
      }}
    >
      {children}
    </span>
  );
}
