/** 本文の改行。段落の切れ目なら、段落の間を少し空ける */
export function ParagraphBreak({ paragraph = true }: { paragraph?: boolean }) {
  return <span style={{ display: 'block', height: paragraph ? 12 : 0 }} />;
}
