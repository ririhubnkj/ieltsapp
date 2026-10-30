interface ConfirmDialogProps {
  title: string;
  body: string;
  detail?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, detail, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28,36,48,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
        zIndex: 10,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 340,
          background: 'var(--surface)',
          borderRadius: 16,
          padding: '24px 22px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        {detail && (
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 13.5,
              color: 'var(--text)',
              background: 'var(--bg)',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            {detail}
          </div>
        )}
        <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{body}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button className="secondary-btn" style={{ flex: 1, borderColor: 'var(--border)' }} onClick={onCancel}>
            キャンセル
          </button>
          <button
            style={{
              flex: 1,
              textAlign: 'center',
              padding: 12,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              background: danger ? 'var(--danger)' : 'var(--accent)',
              color: '#fff',
            }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
