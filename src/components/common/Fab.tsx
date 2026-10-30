import { PlusIcon } from './icons';

export function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="新規登録"
      style={{
        position: 'absolute',
        right: 22,
        bottom: 34,
        width: 56,
        height: 56,
        borderRadius: 16,
        background: 'var(--accent)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 20px rgba(61,90,128,0.35)',
      }}
    >
      <PlusIcon />
    </button>
  );
}
