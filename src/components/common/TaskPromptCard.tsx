import { useState } from 'react';
import type { TaskPrompt } from '../../lib/presetLibrary';

interface TaskPromptCardProps {
  prompt: TaskPrompt;
}

/**
 * TOEFL の問題文(Email と Academic Discussion)。図と同じく画面の上部に固定し、本文だけを下でスクロールさせる。
 * 長い問題文はカードの中でスクロールでき、右上の「たたむ」で本文を広く使える。
 */
export function TaskPromptCard({ prompt }: TaskPromptCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isDiscussion = prompt.posts.length > 0;

  if (collapsed) {
    return (
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
        問題文を表示 ▼
      </button>
    );
  }

  return (
    <div
      style={{
        flexShrink: 0,
        margin: '0 12px 8px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        position: 'relative',
      }}
    >
      <div
        style={{
          maxHeight: '32dvh',
          overflowY: 'auto',
          padding: '10px 14px 12px',
          fontSize: 12.5,
          lineHeight: 1.6,
          color: 'var(--text)',
        }}
      >
        {/* たたむボタンと重ならないよう、見出しの行は右を空ける */}
        <div style={{ paddingRight: 72, color: 'var(--text-muted)', fontSize: 12 }}>
          {prompt.headers.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
        {prompt.paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              margin: '6px 0 0',
              // Email は最後の指示文を太字にする。Academic Discussion は教授の質問の方が大事なので太字にしない
              fontWeight: !isDiscussion && i === prompt.paragraphs.length - 1 ? 700 : 400,
            }}
          >
            {p}
          </p>
        ))}
        {isDiscussion ? (
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            {prompt.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {prompt.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        )}
        {prompt.posts.map((post, i) => (
          <div
            key={post.name}
            style={{
              marginTop: 8,
              padding: '6px 10px',
              borderRadius: 8,
              // 1つ目は教授の質問、続く2つが学生の投稿
              background: i === 0 ? 'var(--accent-soft)' : 'var(--bg)',
            }}
          >
            <span style={{ fontWeight: 700 }}>{post.name}: </span>
            {post.text}
          </div>
        ))}
      </div>
      <button
        onClick={() => setCollapsed(true)}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          border: '1px solid var(--border)',
          borderRadius: 999,
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          fontSize: 11.5,
          fontWeight: 600,
          padding: '3px 10px',
        }}
      >
        たたむ ▲
      </button>
    </div>
  );
}
