/**
 * 英文の読み上げ(ブラウザの音声合成)。イギリス英語の声を優先する。
 * 端末に英語の声が無ければ、使えないものとして扱う
 */

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** 使う声。en-GB を優先し、無ければほかの英語 */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => /^en[-_]/i.test(v.lang));
  return (
    english.find((v) => /en[-_]GB/i.test(v.lang) && /Daniel|Serena|Kate|Google UK|Female|Male/i.test(v.name)) ??
    english.find((v) => /en[-_]GB/i.test(v.lang)) ??
    english[0] ??
    null
  );
}

/**
 * 文を順に読み上げる。onSentence は読み始めた文の番号を知らせる(表示の強調用)。
 * 返す関数で止める
 */
export function speak(
  sentences: string[],
  { rate = 1, onSentence, onEnd }: { rate?: number; onSentence?: (i: number) => void; onEnd?: () => void } = {},
): () => void {
  if (!speechSupported() || sentences.length === 0) {
    onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const voice = pickVoice(synth.getVoices());
  let stopped = false;
  sentences.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = voice?.lang ?? 'en-GB';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onstart = () => !stopped && onSentence?.(i);
    if (i === sentences.length - 1) u.onend = () => !stopped && onEnd?.();
    synth.speak(u);
  });
  return () => {
    stopped = true;
    synth.cancel();
  };
}

/** 本文を文に分ける(読み上げの区切りと、繰り返しの単位) */
export function splitSentences(text: string): string[] {
  // 8.4 のような小数では切らず、文末の記号のあとの空白で切る
  return text
    .replace(/\{\{\+?|\}\}/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
