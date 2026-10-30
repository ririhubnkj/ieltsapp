import { tokenize } from './tokenize';
import { lineBreaks } from './presets';
import { alignTokens } from './tokenDiff';
import type { Entry, MarkingRange } from '../types';

// 前の語とくっつける記号(後ろに空白を入れない)と、次の語とくっつける記号
const ATTACH_LEFT = /^[.,!?;:%)\]}’…]$|^'$/;
const ATTACH_RIGHT = /^[$(\[{‘“#]$/;

/** トークンと改行位置から、編集用の本文を組み立てる(" は開き・閉じを交互に扱う) */
export function entryText(tokens: string[], breaks: Map<number, boolean>): string {
  let text = '';
  let quoteOpen = false;
  let glueNext = true;
  tokens.forEach((token, i) => {
    const closingQuote = (token === '"' && quoteOpen) || token === '”';
    if (!glueNext && !ATTACH_LEFT.test(token) && !closingQuote) text += ' ';
    text += token;
    if (token === '"') quoteOpen = !quoteOpen;
    glueNext = ATTACH_RIGHT.test(token) || (token === '"' && quoteOpen);
    const br = breaks.get(i);
    if (br !== undefined) {
      text += br ? '\n\n' : '\n';
      glueNext = true;
    }
  });
  return text;
}

/**
 * 本文を書き換えた英文を作る。書き換えていない語のマーキング・固定・除外・和訳の修正は引き継ぎ、
 * 書き換えた語の分は消す。改行位置は新しい本文から取り直す
 */
export function editedEntry(
  entry: Entry,
  ranges: MarkingRange[],
  text: string,
): { entry: Entry; ranges: MarkingRange[] } {
  const tokens = tokenize(text);
  const map = alignTokens(entry.tokens, tokens);
  const moveAll = (list: number[] | undefined) =>
    list && list.flatMap((i) => (map.has(i) ? [map.get(i)!] : [])).sort((a, b) => a - b);
  const glosses =
    entry.glosses &&
    Object.fromEntries(Object.entries(entry.glosses).flatMap(([k, v]) => (map.has(Number(k)) ? [[String(map.get(Number(k))), v]] : [])));
  const breaks = [...lineBreaks(text)];
  return {
    entry: {
      ...entry,
      tokens,
      pinned: moveAll(entry.pinned),
      excluded: moveAll(entry.excluded),
      glosses,
      breaks: breaks.length ? breaks : undefined,
      edited: true,
    },
    ranges: ranges.flatMap((r) =>
      map.has(r.start) && map.has(r.end) ? [{ start: map.get(r.start)!, end: map.get(r.end)! }] : [],
    ),
  };
}
