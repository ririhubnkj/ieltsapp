import type { Entry } from '../types';

export interface AdjacentEntries {
  prev: Entry | null;
  next: Entry | null;
  /** 0始まりの位置。現在の題材が一覧に含まれない場合は -1 */
  position: number;
  total: number;
}

/** 登録順の一覧で、現在の題材の前後にある題材を返す */
export function adjacentEntries(entries: Entry[], currentId: string): AdjacentEntries {
  const position = entries.findIndex((e) => e.id === currentId);
  return {
    prev: position > 0 ? entries[position - 1]! : null,
    next: position >= 0 && position < entries.length - 1 ? entries[position + 1]! : null,
    position,
    total: entries.length,
  };
}
