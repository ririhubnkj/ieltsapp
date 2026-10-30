import { useRef, useState } from 'react';
import { imageFileToFigure } from '../../lib/figureImage';

interface FigureAttachProps {
  figure: string | undefined;
  onChange: (figure: string | undefined) => void;
}

/** 図(IELTS Task 1 のグラフなど)の画像を添付・変更・削除する */
export function FigureAttach({ figure, onChange }: FigureAttachProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    const url = await imageFileToFigure(file);
    setLoading(false);
    if (url) onChange(url);
    else setError('この画像は読み込めませんでした。PNG や JPEG の画像を選んでください。');
  };

  const linkStyle = { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, padding: 4 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>図・画像(任意)</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => inputRef.current?.click()} disabled={loading} style={linkStyle}>
            {loading ? '読み込み中…' : figure ? '画像を変更' : '画像を添付'}
          </button>
          {figure && (
            <button onClick={() => onChange(undefined)} style={{ ...linkStyle, color: 'var(--text-muted)' }}>
              外す
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {figure ? (
        <img
          src={figure}
          alt="添付した図"
          style={{
            display: 'block',
            width: '100%',
            maxHeight: 180,
            objectFit: 'contain',
            marginTop: 6,
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 10,
          }}
        />
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          IELTS Task 1 のグラフなどを添付すると、学習中は画面の上部に表示されます
        </div>
      )}
      {error && <div style={{ fontSize: 12.5, color: '#b23b3b', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
