import { getTaskPromptChoices } from '../../lib/presetLibrary';

interface TaskPromptPickerProps {
  promptId: string | undefined;
  onChange: (promptId: string | undefined, label: string | undefined) => void;
}

/**
 * TOEFL の問題(Email・Academic Discussion)を選ぶ。問題文は固定で、英文はモデルアンサーでも自分の解答でもよい。
 * 選んだ問題文は、学習中に画面の上部に表示される
 */
export function TaskPromptPicker({ promptId, onChange }: TaskPromptPickerProps) {
  const groups = getTaskPromptChoices();

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>TOEFL の問題(任意)</div>
      <select
        value={promptId ?? ''}
        onChange={(e) => {
          const id = e.target.value || undefined;
          const label = groups.flatMap((g) => g.options).find((o) => o.id === id)?.label;
          onChange(id, label);
        }}
        style={{
          width: '100%',
          marginTop: 4,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 14,
          color: 'var(--text)',
        }}
      >
        <option value="">なし</option>
        {groups.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {!promptId && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          選ぶと、学習中は問題文が画面の上部に表示されます。英文はモデルアンサーでも自分の解答でも大丈夫です
        </div>
      )}
    </div>
  );
}
