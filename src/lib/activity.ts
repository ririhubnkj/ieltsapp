/**
 * 学習の記録(学習記録の画面で、連続日数・日ごとの量・点数の推移を出すのに使う)。
 * この端末に保存する。英文のデータとは別に持つ
 */

export type ActivityKind = 'quiz' | 'review' | 'reading' | 'mock' | 'writing' | 'speaking';

export interface Activity {
  kind: ActivityKind;
  /** ISO 形式の日時 */
  at: string;
  /** 何をしたか(題材の名前など) */
  title: string;
  /** 点数のあるもの(Reading・模試は正答数、Writing は語数など) */
  score?: number;
  total?: number;
  /** バンドの目安(Reading・模試) */
  band?: number;
  /** かかった秒数 */
  seconds?: number;
}

const KEY = 'ielts_activity_v1';
/** 古い記録から捨てる上限 */
const MAX = 2000;

export function loadActivities(): Activity[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Activity[]) : [];
  } catch {
    return [];
  }
}

export function logActivity(activity: Omit<Activity, 'at'>, now = new Date()): void {
  try {
    const next = [...loadActivities(), { ...activity, at: now.toISOString() }].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 保存できない環境では記録しない
  }
}

/** その日の日付(端末の時刻で YYYY-MM-DD) */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 今日まで続けて学習した日数(今日まだ学習していなければ、昨日までの連続日数) */
export function streakDays(activities: Activity[], now = new Date()): number {
  const days = new Set(activities.map((a) => dayKey(new Date(a.at))));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(d))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** 直近 n 日の、日ごとの回数(古い日から) */
export function dailyCounts(activities: Activity[], n: number, now = new Date()): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of activities) {
    const k = dayKey(new Date(a.at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...Array(n).keys()].reverse().map((i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    return { day: k, count: counts.get(k) ?? 0 };
  });
}
