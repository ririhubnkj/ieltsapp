import { useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import type { MarkingRange } from '../types';

export function useMarkings(entryId: string) {
  const { data, dispatch } = useAppData();

  const ranges = useMemo(
    () => data.markings.find((m) => m.entryId === entryId)?.ranges ?? [],
    [data.markings, entryId],
  );

  const setRanges = useCallback(
    (next: MarkingRange[]) => {
      dispatch({ type: 'SET_MARKING_RANGES', entryId, ranges: next });
    },
    [dispatch, entryId],
  );

  return { ranges, setRanges };
}
