import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTaskPromptChoices } from '../../lib/presetLibrary';
import type { Entry } from '../../types';

const COLLAPSED_KEY = 'eiwaku_collapsed_prompt_groups';

function loadCollapsed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveCollapsed(groups: string[]): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(groups));
  } catch {
    // 保存できない環境では毎回開いた状態から
  }
}

/**
 * 公開版のホームに並べる TOEFL の問題の一覧(Email・Academic Discussion)。
 * 未登録の問題を押すとその問題を選んだ状態で登録画面を開き、登録済みなら登録した英文を開く
 */
export function TaskPromptList({ entries }: { entries: Entry[] }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggle = (group: string) => {
    const next = collapsed.includes(group) ? collapsed.filter((g) => g !== group) : [...collapsed, group];
    setCollapsed(next);
    saveCollapsed(next);
  };

  return (
    <>
      {getTaskPromptChoices().map(({ group, options }) => {
        const open = !collapsed.includes(group);
        const done = options.filter((o) => entries.some((e) => e.promptId === o.id)).length;
        return (
          <div key={group} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => toggle(group)}
              aria-expanded={open}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                textAlign: 'left',
              }}
            >
              <span style={{ flex: 1 }}>{group}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginRight: 8 }}>
                登録済み {done}/{options.length}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
            </button>
            {open &&
              options.map((o) => {
                // 同じ問題で複数登録していたら、いちばん新しい英文を開く
                const entry = entries.filter((e) => e.promptId === o.id).at(-1);
                return (
                  <button
                    key={o.id}
                    onClick={() => navigate(entry ? `/entries/${entry.id}` : `/new?prompt=${o.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      borderTop: '1px solid var(--border)',
                      padding: '10px 16px',
                      fontSize: 13.5,
                      color: 'var(--text)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ flex: 1 }}>{o.label}</span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 11.5,
                        fontWeight: 600,
                        borderRadius: 999,
                        padding: '2px 9px',
                        color: entry ? 'var(--success)' : 'var(--accent)',
                        background: entry ? 'transparent' : 'var(--accent-soft)',
                      }}
                    >
                      {entry ? '登録済み' : '英文を登録'}
                    </span>
                  </button>
                );
              })}
          </div>
        );
      })}
    </>
  );
}
