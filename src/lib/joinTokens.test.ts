import { describe, expect, it } from 'vitest';
import { joinTokens } from './joinTokens';

describe('joinTokens', () => {
  it('joins plain words with single spaces', () => {
    expect(joinTokens(['hello', 'world'])).toBe('hello world');
  });

  it('attaches punctuation to the preceding token without a leading space', () => {
    expect(joinTokens(['market', ',', 'companies', '.'])).toBe('market, companies.');
  });

  it('keeps consecutive punctuation tight together (ellipsis)', () => {
    expect(joinTokens(['wait', '.', '.', '.'])).toBe('wait...');
  });

  it('keeps consecutive punctuation tight together (?!)', () => {
    expect(joinTokens(['really', '?', '!'])).toBe('really?!');
  });

  it('returns an empty string for no tokens', () => {
    expect(joinTokens([])).toBe('');
  });
});
