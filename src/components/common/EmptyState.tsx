export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}
    >
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{message}</p>
      {action}
    </div>
  );
}
