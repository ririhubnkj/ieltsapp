import { Fragment } from 'react';
import { isMarked } from '../../lib/markingLogic';
import { isWordToken } from '../../lib/tokenize';
import type { MarkingRange } from '../../types';
import { WordToken } from './WordToken';
import { ParagraphBreak } from './ParagraphBreak';

interface MarkingParagraphProps {
  tokens: string[];
  ranges: MarkingRange[];
  activeIndex: number | null;
  onTap: (index: number) => void;
  /** 行の最後のトークンのインデックス → 段落の切れ目なら true(この後で改行する) */
  lineBreaks?: Map<number, boolean>;
}

export function MarkingParagraph({ tokens, ranges, activeIndex, onTap, lineBreaks }: MarkingParagraphProps) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 17,
        lineHeight: 2.15,
      }}
    >
      {tokens.map((token, i) => {
        const isWord = isWordToken(token);
        const nextIsPunct = i + 1 < tokens.length && !isWordToken(tokens[i + 1]!);
        const marked = isMarked(ranges, i);
        const variant = marked ? (activeIndex === i ? 'markedActive' : 'marked') : 'normal';
        return (
          <Fragment key={i}>
            {i > 0 && isWord && ' '}
            <WordToken
              variant={variant}
              paddingLeft={isWord ? 3 : 0}
              paddingRight={isWord ? (nextIsPunct ? 0 : 3) : 0}
              onClick={isWord ? () => onTap(i) : undefined}
            >
              {token}
            </WordToken>
            {lineBreaks?.has(i) && <ParagraphBreak paragraph={lineBreaks.get(i)} />}
          </Fragment>
        );
      })}
    </div>
  );
}
