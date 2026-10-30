import type { SessionRecord } from '../types';

export function studyCount(sessions: SessionRecord[]): number {
  return sessions.length;
}

export function sessionsForEntry(sessions: SessionRecord[], entryId: string): SessionRecord[] {
  return sessions
    .filter((s) => s.entryId === entryId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function lastStudiedAt(sessions: SessionRecord[]): string | null {
  if (sessions.length === 0) return null;
  return sessions.reduce((latest, s) => (s.timestamp > latest ? s.timestamp : latest), sessions[0]!.timestamp);
}
