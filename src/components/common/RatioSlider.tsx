interface RatioSliderProps {
  ratio: number;
  onChange?: (ratio: number) => void;
  disabled?: boolean;
  caption?: string;
}

export function RatioSlider({ ratio, onChange, disabled, caption }: RatioSliderProps) {
  const percent = Math.round(ratio * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        {caption && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{caption}</span>}
        <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)', marginLeft: 'auto' }}>{percent}%</span>
      </div>
      <input
        type="range"
        min={10}
        max={100}
        step={10}
        value={percent}
        disabled={disabled}
        onChange={(e) => onChange?.(Number(e.target.value) / 100)}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
        aria-label="出題する割合"
      />
    </div>
  );
}
