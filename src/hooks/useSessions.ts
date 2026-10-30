import { useCallback, useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { sessionsForEntry, studyCount } from '../lib/stats';

export function useSessions(entryId: string) {
  const { data, dispatch } = useAppData();

  const sessions = useMemo(() => sessionsForEntry(data.sessions, entryId), [data.sessions, entryId]);

  const addSession = useCallback(
    (totalQuestions: number) => {
      dispatch({
        type: 'ADD_SESSION',
        session: {
          id: crypto.randomUUID(),
          entryId,
          timestamp: new Date().toISOString(),
          totalQuestions,
          // 自己採点は廃止したため記録しない(旧データとの互換のためフィールドは残す)
          correctCount: 0,
        },
      });
    },
    [dispatch, entryId],
  );

  return {
    sessions,
    addSession,
    studyCount: studyCount(sessions),
  };
}
