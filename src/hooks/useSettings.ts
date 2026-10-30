import { useCallback } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { QuizMode } from '../types';

export function useSettings() {
  const { data, dispatch } = useAppData();

  const setQuizRatio = useCallback(
    (ratio: number) => {
      dispatch({ type: 'SET_QUIZ_RATIO', ratio });
    },
    [dispatch],
  );

  const setQuizMode = useCallback(
    (mode: QuizMode) => {
      dispatch({ type: 'SET_QUIZ_MODE', mode });
    },
    [dispatch],
  );

  const setShowGlossHints = useCallback(
    (show: boolean) => {
      dispatch({ type: 'SET_SHOW_GLOSS_HINTS', show });
    },
    [dispatch],
  );

  return {
    settings: data.settings,
    quizMode: data.settings.quizMode ?? 'marked',
    showGlossHints: data.settings.showGlossHints ?? true,
    setQuizRatio,
    setQuizMode,
    setShowGlossHints,
  };
}
