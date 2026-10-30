export function formatRelativeDate(iso: string | null, now: Date = new Date()): string {
  if (iso === null) return '未学習';
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return '今日';
  if (diffDays === 1) return '1日前';
  if (diffDays < 30) return `${diffDays}日前`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}ヶ月前`;
  return `${Math.floor(diffMonths / 12)}年前`;
}
