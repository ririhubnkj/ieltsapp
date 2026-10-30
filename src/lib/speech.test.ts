import { describe, expect, it } from 'vitest';
import { pickVoice, splitSentences } from './speech';

describe('splitSentences', () => {
  it('splits at sentence ends but not inside numbers, and drops the marking braces', () => {
    expect(splitSentences('It rose to 8.4 in {{2020}}. Then it {{fell}}! Why?')).toEqual([
      'It rose to 8.4 in 2020.',
      'Then it fell!',
      'Why?',
    ]);
  });
});

describe('pickVoice', () => {
  const v = (name: string, lang: string) => ({ name, lang }) as SpeechSynthesisVoice;
  it('prefers a British voice', () => {
    expect(pickVoice([v('Alex', 'en-US'), v('Daniel', 'en-GB')])?.name).toBe('Daniel');
    expect(pickVoice([v('Kyoko', 'ja-JP'), v('Alex', 'en-US')])?.name).toBe('Alex');
    expect(pickVoice([v('Kyoko', 'ja-JP')])).toBeNull();
  });
});
