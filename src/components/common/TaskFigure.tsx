import { useState } from 'react';

interface TaskFigureProps {
  /** 図の画像(内蔵の図は SVG、自分で添付した図は縮小した画像の data URL) */
  src: string;
}

/**
 * IELTS Task 1 の図(内蔵の図、または自分で添付した図)。画面の上部に固定し、本文だけを下でスクロールさせる。
 * タップで全画面に拡大、右上の「たたむ」で本文を広く使える。
 */
export function TaskFigure({ src }: TaskFigureProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            flexShrink: 0,
            margin: '0 12px 8px',
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--surface)',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 0',
          }}
        >
          図を表示 ▼
        </button>
      ) : (
        <div
          style={{
            flexShrink: 0,
            margin: '0 12px 8px',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <button
            onClick={() => setZoomed(true)}
            aria-label="図を拡大"
            style={{ display: 'block', width: '100%', border: 'none', background: 'none', padding: 4 }}
          >
            <img
              src={src}
              alt="問題の図"
              style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '32dvh', objectFit: 'contain' }}
            />
          </button>
          {/* たたむボタンは図の右上に重ね、図の下に行を増やさない */}
          <button
            onClick={() => setCollapsed(true)}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              border: '1px solid var(--border)',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.92)',
              color: 'var(--text-muted)',
              fontSize: 11.5,
              fontWeight: 600,
              padding: '3px 10px',
            }}
          >
            たたむ ▲
          </button>
        </div>
      )}
      {zoomed && (
        <div
          role="dialog"
          aria-label="拡大した図"
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(20, 26, 36, 0.85)',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'safe center',
            padding: 12,
          }}
        >
          {/* 縦向きのスマホでも細部が読めるよう大きめに描き、はみ出した分は横スクロールで見る */}
          <img
            src={src}
            alt="問題の図(拡大)"
            style={{ display: 'block', width: '100%', minWidth: 720, margin: 'auto', background: '#fff', borderRadius: 10 }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 18,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: '#fff',
              fontSize: 12.5,
              pointerEvents: 'none',
            }}
          >
            横にスクロールして見られます・タップで閉じる
          </div>
        </div>
      )}
    </>
  );
}
