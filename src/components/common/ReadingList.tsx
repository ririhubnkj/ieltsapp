import { useNavigate } from 'react-router-dom';
import { loadResults, PASSAGES, totalMarks, TYPE_LABEL } from '../../lib/reading';
import { formatRelativeDate } from '../../lib/relativeDate';

/** Reading のタブ。本番と同じ形式の演習(本文1つに設問13問)を並べる */
export function ReadingList() {
  const navigate = useNavigate();
  const results = loadResults();
  return (
    <>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        本番と同じ設問形式(見出し選択・段落選択・TRUE/FALSE/NOT GIVEN・YES/NO/NOT GIVEN・4択・2つ選ぶ・組み合わせ・文の後半選択・要約完成・空所補充・短答)の演習です。
        1題20分が目安。採点後に、根拠の段落と日本語の解説を確認できます。
      </div>
      {PASSAGES.map((p, i) => {
        const result = results[p.id];
        const total = totalMarks(p);
        return (
          <div
            key={p.id}
            className="card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/reading/${p.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/reading/${p.id}`)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Passage {i + 1}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 500 }}>{p.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{p.titleJa}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {p.groups.map((g) => (
                <span
                  key={g.questions[0]!.num}
                  style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-soft)', borderRadius: 999, padding: '2px 8px' }}
                >
                  {TYPE_LABEL[g.type]}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
              <span>{total}問・{p.minutes}分</span>
              {result ? (
                <>
                  <span>
                    最高 {result.best}/{result.total}・前回 {result.last}/{result.total}
                  </span>
                  <span style={{ marginLeft: 'auto' }}>{formatRelativeDate(result.at)}</span>
                </>
              ) : (
                <span>未挑戦</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
