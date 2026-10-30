import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_DECKS } from '../lib/decks';
import type { AppData, Deck, Entry, MarkingRange, MarkingSet, QuizMode, SessionRecord } from '../types';
import { loadData, saveData } from '../lib/storage';
import { CloudSync, type RemoteChange, type SyncStatus } from '../lib/cloudSync';
import { IS_PERSONAL } from '../lib/target';

type Action =
  | { type: 'ADD_ENTRY'; entry: Entry }
  | { type: 'ADD_ENTRIES'; entries: Entry[]; markings?: MarkingSet[] }
  | { type: 'REPLACE_ENTRIES'; entries: Entry[]; markings: MarkingSet[] }
  | { type: 'DELETE_ENTRY'; entryId: string }
  | { type: 'SET_ENTRY_TITLE'; entryId: string; title: string | undefined }
  | { type: 'SET_ENTRY_FIGURE'; entryId: string; figure: string | undefined }
  | { type: 'SET_ENTRY_PROMPT'; entryId: string; promptId: string | undefined }
  | { type: 'SET_MARKING_RANGES'; entryId: string; ranges: MarkingRange[] }
  | { type: 'ADD_SESSION'; session: SessionRecord }
  | { type: 'SET_QUIZ_RATIO'; ratio: number }
  | { type: 'SET_QUIZ_MODE'; mode: QuizMode }
  | { type: 'SET_SHOW_GLOSS_HINTS'; show: boolean }
  | { type: 'SET_DECKS'; decks: Deck[] }
  | { type: 'TOGGLE_PIN'; entryId: string; index: number }
  | { type: 'CLEAR_PINS'; entryId: string }
  | { type: 'TOGGLE_EXCLUDE'; entryId: string; index: number }
  | { type: 'CLEAR_EXCLUDED'; entryId: string }
  | { type: 'REPLACE_ALL'; data: AppData }
  | { type: 'APPLY_REMOTE'; change: RemoteChange };

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [...state.entries, action.entry],
        markings: [...state.markings, { entryId: action.entry.id, ranges: [] }],
      };
    case 'ADD_ENTRIES':
      return {
        ...state,
        entries: [...state.entries, ...action.entries],
        markings: [
          ...state.markings,
          ...action.entries.map(
            (e) => action.markings?.find((m) => m.entryId === e.id) ?? { entryId: e.id, ranges: [] },
          ),
        ],
      };
    case 'REPLACE_ENTRIES': {
      const replaced = new Map(action.entries.map((e) => [e.id, e]));
      const ranges = new Map(action.markings.map((m) => [m.entryId, m.ranges]));
      return {
        ...state,
        entries: state.entries.map((e) => replaced.get(e.id) ?? e),
        markings: state.markings.map((m) => (ranges.has(m.entryId) ? { ...m, ranges: ranges.get(m.entryId)! } : m)),
      };
    }
    case 'DELETE_ENTRY':
      return {
        ...state,
        entries: state.entries.filter((e) => e.id !== action.entryId),
        markings: state.markings.filter((m) => m.entryId !== action.entryId),
        sessions: state.sessions.filter((s) => s.entryId !== action.entryId),
      };
    case 'SET_ENTRY_TITLE':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.entryId ? { ...e, title: action.title } : e,
        ),
      };
    case 'SET_ENTRY_FIGURE':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.entryId ? { ...e, figure: action.figure } : e,
        ),
      };
    case 'SET_ENTRY_PROMPT':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.entryId ? { ...e, promptId: action.promptId } : e,
        ),
      };
    case 'SET_MARKING_RANGES': {
      const exists = state.markings.some((m) => m.entryId === action.entryId);
      const markings = exists
        ? state.markings.map((m) =>
            m.entryId === action.entryId ? { ...m, ranges: action.ranges } : m,
          )
        : [...state.markings, { entryId: action.entryId, ranges: action.ranges }];
      return { ...state, markings };
    }
    case 'ADD_SESSION':
      return { ...state, sessions: [...state.sessions, action.session] };
    case 'SET_QUIZ_RATIO':
      return { ...state, settings: { ...state.settings, quizRatio: action.ratio } };
    case 'SET_QUIZ_MODE':
      return { ...state, settings: { ...state.settings, quizMode: action.mode } };
    case 'SET_SHOW_GLOSS_HINTS':
      return { ...state, settings: { ...state.settings, showGlossHints: action.show } };
    case 'SET_DECKS':
      return {
        ...state,
        settings: { ...state.settings, decks: action.decks, knownDeckIds: DEFAULT_DECKS.map((d) => d.id) },
      };
    case 'TOGGLE_PIN':
      return {
        ...state,
        entries: state.entries.map((e) => {
          if (e.id !== action.entryId) return e;
          const pinned = e.pinned ?? [];
          return {
            ...e,
            pinned: pinned.includes(action.index)
              ? pinned.filter((i) => i !== action.index)
              : [...pinned, action.index].sort((a, b) => a - b),
            // 固定と除外は同時に指定できない
            excluded: (e.excluded ?? []).filter((i) => i !== action.index),
          };
        }),
      };
    case 'TOGGLE_EXCLUDE':
      return {
        ...state,
        entries: state.entries.map((e) => {
          if (e.id !== action.entryId) return e;
          const excluded = e.excluded ?? [];
          return {
            ...e,
            excluded: excluded.includes(action.index)
              ? excluded.filter((i) => i !== action.index)
              : [...excluded, action.index].sort((a, b) => a - b),
            pinned: (e.pinned ?? []).filter((i) => i !== action.index),
          };
        }),
      };
    case 'CLEAR_EXCLUDED':
      return {
        ...state,
        entries: state.entries.map((e) => (e.id === action.entryId ? { ...e, excluded: [] } : e)),
      };
    case 'CLEAR_PINS':
      return {
        ...state,
        entries: state.entries.map((e) => (e.id === action.entryId ? { ...e, pinned: [] } : e)),
      };
    case 'REPLACE_ALL':
      return action.data;
    case 'APPLY_REMOTE': {
      const { settings, upserts, deletes } = action.change;
      const changed = new Set([...deletes, ...upserts.map((d) => d.entry.id)]);
      const kept = state.entries.filter((e) => !deletes.includes(e.id));
      const entries = [
        ...kept.map((e) => upserts.find((d) => d.entry.id === e.id)?.entry ?? e),
        ...upserts.filter((d) => !kept.some((e) => e.id === d.entry.id)).map((d) => d.entry),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return {
        ...state,
        settings: settings ?? state.settings,
        entries,
        markings: [
          ...state.markings.filter((m) => !changed.has(m.entryId)),
          ...upserts.map((d) => ({ entryId: d.entry.id, ranges: d.ranges ?? [] })),
        ],
        sessions: [
          ...state.sessions.filter((s) => !changed.has(s.entryId)),
          ...upserts.flatMap((d) => d.sessions ?? []),
        ].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      };
    }
    default:
      return state;
  }
}

interface AppDataContextValue {
  data: AppData;
  dispatch: React.Dispatch<Action>;
  /** 個人版の端末間同期の状態(公開版では常に offline) */
  syncStatus: SyncStatus;
  /** 端末の保存容量が足りず、最後の変更を保存できなかった */
  saveFailed: boolean;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, loadData);

  const syncStatus = useCloudSync(data, dispatch);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveData(data));
  }, [data]);

  const value = useMemo(() => ({ data, dispatch, syncStatus, saveFailed }), [data, syncStatus, saveFailed]);

  return (
    <AppDataContext.Provider value={value}>
      {children}
      {saveFailed && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 60,
            background: '#7a2e2e',
            color: '#fff',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          端末の保存容量が足りず、変更を保存できませんでした。添付した図を外すか、使わない題材を削除してください。
        </div>
      )}
    </AppDataContext.Provider>
  );
}

/** 個人版だけ、claude.ai アーティファクトの db と同期する */
function useCloudSync(data: AppData, dispatch: React.Dispatch<Action>): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(IS_PERSONAL ? 'connecting' : 'offline');
  const syncRef = useRef<CloudSync | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!IS_PERSONAL) return;
    let cancelled = false;
    let sync: CloudSync | null = null;
    (async () => {
      const db = (await window.claude?.use('db').catch(() => null)) ?? null;
      if (cancelled) return;
      if (!db) {
        setStatus('offline');
        return;
      }
      sync = new CloudSync(db, dataRef.current, {
        replaceAll: (next) => dispatch({ type: 'REPLACE_ALL', data: next }),
        applyRemote: (change) => dispatch({ type: 'APPLY_REMOTE', change }),
        status: setStatus,
      });
      syncRef.current = sync;
      await sync.start();
    })().catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => {
      cancelled = true;
      sync?.stop();
      syncRef.current = null;
    };
  }, [dispatch]);

  useEffect(() => {
    syncRef.current?.flush(data);
  }, [data]);

  return status;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
