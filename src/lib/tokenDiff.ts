/**
 * 2つのトークン列の最長共通部分列をとり、書き換え後も残ったトークンの位置を
 * 書き換え前 → 書き換え後 に対応づける(本文を編集しても、変えていない語のマーキングなどを引き継ぐため)
 */
export function alignTokens(before: string[], after: string[]): Map<number, number> {
  const map = new Map<number, number>();
  // 先頭と末尾の一致部分は表を作らずに対応づける
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) {
    map.set(head, head);
    head++;
  }
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    map.set(before.length - 1 - tail, after.length - 1 - tail);
    tail++;
  }

  const a = before.slice(head, before.length - tail);
  const b = after.slice(head, after.length - tail);
  const w = b.length + 1;
  // lcs[i * w + j] = a[i..] と b[j..] の最長共通部分列の長さ
  const lcs = new Int32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1]! + 1 : Math.max(lcs[(i + 1) * w + j]!, lcs[i * w + j + 1]!);
    }
  }
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      map.set(head + i, head + j);
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j]! >= lcs[i * w + j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return map;
}
