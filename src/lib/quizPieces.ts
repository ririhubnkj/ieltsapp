import { isWordToken } from './tokenize';
import { joinTokens } from './joinTokens';
import type { MarkingRange } from '../types';

export type QuizPiece =
  | { type: 'text'; text: string; leadsWithWord: boolean; start: number; end: number }
  | { type: 'blank'; rangeIndex: number; label: string };

export function buildQuizPieces(tokens: string[], quizRanges: MarkingRange[]): QuizPiece[] {
  const pieces: QuizPiece[] = [];
  let cursor = 0;

  quizRanges.forEach((range, j) => {
    if (range.start > cursor) {
      const slice = tokens.slice(cursor, range.start);
      pieces.push({
        type: 'text',
        text: joinTokens(slice),
        leadsWithWord: isWordToken(slice[0]!),
        start: cursor,
        end: range.start - 1,
      });
    }
    pieces.push({ type: 'blank', rangeIndex: j, label: joinTokens(tokens.slice(range.start, range.end + 1)) });
    cursor = range.end + 1;
  });

  if (cursor < tokens.length) {
    const slice = tokens.slice(cursor);
    pieces.push({
      type: 'text',
      text: joinTokens(slice),
      leadsWithWord: isWordToken(slice[0]!),
      start: cursor,
      end: tokens.length - 1,
    });
  }

  return pieces;
}
