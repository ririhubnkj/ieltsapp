import { useCallback } from 'react';
import { useAppData } from '../context/AppDataContext';
import { tokenize } from '../lib/tokenize';
import { lineBreaks } from '../lib/presets';
import type { Entry } from '../types';

export function useEntries() {
  const { data, dispatch } = useAppData();

  const addEntry = useCallback(
    (rawText: string, title?: string, deckId?: string, figure?: string, promptId?: string): Entry => {
      const trimmedTitle = title?.trim();
      // 貼り付けた本文の改行・段落はそのまま表示する
      const breaks = [...lineBreaks(rawText.trim())];
      const entry: Entry = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        tokens: tokenize(rawText),
        title: trimmedTitle ? trimmedTitle : undefined,
        deckId,
        figure,
        promptId,
        breaks: breaks.length ? breaks : undefined,
      };
      dispatch({ type: 'ADD_ENTRY', entry });
      return entry;
    },
    [dispatch],
  );

  const setEntryTitle = useCallback(
    (entryId: string, title: string) => {
      const trimmed = title.trim();
      dispatch({ type: 'SET_ENTRY_TITLE', entryId, title: trimmed ? trimmed : undefined });
    },
    [dispatch],
  );

  const setEntryFigure = useCallback(
    (entryId: string, figure: string | undefined) => {
      dispatch({ type: 'SET_ENTRY_FIGURE', entryId, figure });
    },
    [dispatch],
  );

  const setEntryPrompt = useCallback(
    (entryId: string, promptId: string | undefined) => {
      dispatch({ type: 'SET_ENTRY_PROMPT', entryId, promptId });
    },
    [dispatch],
  );

  const deleteEntry = useCallback(
    (entryId: string) => {
      dispatch({ type: 'DELETE_ENTRY', entryId });
    },
    [dispatch],
  );

  const getEntry = useCallback(
    (entryId: string) => data.entries.find((e) => e.id === entryId),
    [data.entries],
  );

  return { entries: data.entries, addEntry, deleteEntry, getEntry, setEntryTitle, setEntryFigure, setEntryPrompt };
}
