import { useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { DEFAULT_DECKS, deckIdOf, withNewDefaultDecks } from '../lib/decks';
import { HAS_PRESETS } from '../lib/target';
import type { Deck, Entry } from '../types';

/** ホームのタブ(自分専用版だけ。公開版ではタブを使わず全件を1つの一覧にする) */
export function useDecks() {
  const { data, dispatch } = useAppData();
  const stored = data.settings.decks;
  // 保存済みのタブにも、後から増えた既定のタブ(TOEFL など)は足す。知っていた既定のタブを消していたら戻さない
  const decks = useMemo(
    () =>
      stored?.length
        ? withNewDefaultDecks(stored, data.settings.knownDeckIds ?? ['ielts-task2', 'ielts-task1'])
        : DEFAULT_DECKS,
    [stored, data.settings.knownDeckIds],
  );

  const setDecks = useCallback((next: Deck[]) => dispatch({ type: 'SET_DECKS', decks: next }), [dispatch]);

  /** 同じタブに入っている英文だけにする(前後の移動をタブ内にとどめる) */
  const sameDeck = useCallback(
    (entries: Entry[], current: Entry) => {
      if (!HAS_PRESETS) return entries;
      const deckId = deckIdOf(current, decks);
      return entries.filter((e) => deckIdOf(e, decks) === deckId);
    },
    [decks],
  );

  return { enabled: HAS_PRESETS, decks, setDecks, sameDeck };
}
