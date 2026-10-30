import { useCallback } from 'react';
import { useAppData } from '../context/AppDataContext';
import { getLevel, type Level, type LevelId } from '../lib/levels';

/** 選んでいるレベル。未設定なら中級(5.5–6.5) */
export function useLevel(): { level: Level; chosen: boolean; setLevel: (id: LevelId) => void } {
  const { data, dispatch } = useAppData();
  const setLevel = useCallback((id: LevelId) => dispatch({ type: 'UPDATE_SETTINGS', settings: { level: id } }), [dispatch]);
  return { level: getLevel(data.settings.level), chosen: !!data.settings.level, setLevel };
}
