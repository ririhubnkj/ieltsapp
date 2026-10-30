import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { dailyCounts, dayKey, loadActivities, streakDays, type ActivityKind } from '../../lib/activity';
import { dueItems, loadReview } from '../../lib/review';

const KIND_LABEL: Record<ActivityKind, string> = {
  quiz: '穴埋め',
  review: '復習',
  reading: 'Reading',
  mock: '模試',
  writing: 'Writing 本番',
  speaking: 'Speaking 本番',
};

/** 学習記録(ホームの「記録」タブ) */
export function StatsPanel() {
  const navigate = useNavigate();
  const { data, dispatch } = useAppData();
  const activities = loadActivities();
  const now = new Date();
  const today = dayKey(now);
  const todayCount = activities.filter((a) => dayKey(new Date(a.at)) === today).length;
  const goal = data.settings.dailyGoal ?? 3;
  const streak = streakDays(activities, now);
  const days = dailyCounts(activities, 14, now);
  const max = Math.max(goal, ...days.map((d) => d.count));
  const review = loadReview();
  const due = dueItems(review, now).length;
  const scored = activities.filter((a) => (a.kind === 'reading' || a.kind === 'mock') && a.total).slice(-8).reverse();
  const byKind = (Object.keys(KIND_LABEL) as ActivityKind[]).map((k) => ({
    kind: k,
    count: activities.filter((a) => a.kind === k).length,
  }));

  return (
    <>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '2px solid var(--text)', borderBottom: '1px solid var(--border)' }}>
        <Figure value={streak} unit="日" label="連続" />
        <Figure value={todayCount} unit={`/ ${goal}`} label="今日" />
        <Figure value={due} unit="語" label="復習待ち" />
      </section>

      {due > 0 && (
        <button className="primary-btn" onClick={() => navigate('/review')}>
          苦手の復習を始める({due}語)
        </button>
      )}

      <section>
        <h2 className="section-label">直近2週間</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 96, borderBottom: '1px solid var(--text)' }}>
          {days.map((d) => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div
                title={`${d.day}: ${d.count}回`}
                style={{
                  width: '100%',
                  height: Math.max(d.count ? 4 : 1, (d.count / max) * 84),
                  background: d.count >= goal ? 'var(--accent)' : d.count > 0 ? 'var(--accent-soft)' : 'var(--border)',
                  borderTop: d.day === today ? '2px solid var(--brand-red)' : undefined,
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
          <span>{days[0]!.day.slice(5).replace('-', '/')}</span>
          <span>今日</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 12 }}>
          1日の目標
          <select
            value={goal}
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', settings: { dailyGoal: Number(e.target.value) } })}
            style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '4px 8px', fontSize: 13 }}
          >
            {[1, 2, 3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}回
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <h2 className="section-label">Reading の点数</h2>
        {scored.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>まだ記録がありません。</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <tbody>
              {scored.map((a) => (
                <tr key={a.at} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 0', color: 'var(--text-muted)', width: 52 }}>{a.at.slice(5, 10).replace('-', '/')}</td>
                  <td style={{ padding: '7px 0' }}>{a.title}</td>
                  <td style={{ padding: '7px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {a.score}/{a.total}
                  </td>
                  <td style={{ padding: '7px 0 7px 10px', textAlign: 'right', width: 48, fontWeight: 700, color: 'var(--accent)' }}>
                    {a.band?.toFixed(1) ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="section-label">これまでの回数</h2>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 6, fontSize: 13.5 }}>
          {byKind.map(({ kind, count }) => (
            <Row key={kind} label={KIND_LABEL[kind]} value={`${count}回`} />
          ))}
          <Row label="復習に入っている語" value={`${review.length}語`} />
        </dl>
      </section>
    </>
  );
}

function Figure({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <div style={{ padding: '12px 0 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {value}
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ borderBottom: '1px dotted var(--border)', paddingBottom: 4 }}>{label}</dt>
      <dd style={{ margin: 0, borderBottom: '1px dotted var(--border)', paddingBottom: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</dd>
    </>
  );
}
