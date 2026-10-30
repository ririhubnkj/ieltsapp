import type { AppData, ExportFileV1 } from '../types';
import { isFigureDataUrl } from './figureImage';

export function buildExportFile(data: AppData): ExportFileV1 {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      entries: data.entries,
      markings: data.markings,
      sessions: data.sessions,
      settings: data.settings,
    },
  };
}

export type ImportError =
  | { kind: 'parse' }
  | { kind: 'unsupported-version' }
  | { kind: 'invalid-shape' }
  | { kind: 'invalid-reference' };

export type ImportResult =
  | { ok: true; data: AppData }
  | { ok: false; error: ImportError };

export function parseImportFile(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: { kind: 'parse' } };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: { kind: 'invalid-shape' } };
  }
  const o = parsed as Record<string, unknown>;

  if (o.schemaVersion !== 1) {
    return { ok: false, error: { kind: 'unsupported-version' } };
  }

  const d = o.data as Record<string, unknown> | undefined;
  if (
    !d ||
    !Array.isArray(d.entries) ||
    !Array.isArray(d.markings) ||
    !Array.isArray(d.sessions) ||
    typeof (d.settings as Record<string, unknown> | undefined)?.quizRatio !== 'number'
  ) {
    return { ok: false, error: { kind: 'invalid-shape' } };
  }

  const entries = d.entries as { id: unknown; tokens: unknown; title?: unknown; presetId?: unknown; glosses?: unknown; pinned?: unknown; excluded?: unknown; figure?: unknown; promptId?: unknown; breaks?: unknown; edited?: unknown }[];
  for (const e of entries) {
    if (typeof e.id !== 'string' || !Array.isArray(e.tokens)) {
      return { ok: false, error: { kind: 'invalid-shape' } };
    }
    if (
      (e.title !== undefined && typeof e.title !== 'string') ||
      (e.presetId !== undefined && typeof e.presetId !== 'string') ||
      (e.figure !== undefined && !isFigureDataUrl(e.figure)) ||
      (e.promptId !== undefined && typeof e.promptId !== 'string')
    ) {
      return { ok: false, error: { kind: 'invalid-shape' } };
    }
    if (
      e.glosses !== undefined &&
      (typeof e.glosses !== 'object' ||
        e.glosses === null ||
        Object.values(e.glosses).some((g) => typeof g !== 'string'))
    ) {
      return { ok: false, error: { kind: 'invalid-shape' } };
    }
    if (
      (e.edited !== undefined && typeof e.edited !== 'boolean') ||
      (e.breaks !== undefined &&
        (!Array.isArray(e.breaks) ||
          e.breaks.some(
            (b) => !Array.isArray(b) || typeof b[0] !== 'number' || typeof b[1] !== 'boolean' || b[0] < 0 || b[0] >= (e.tokens as unknown[]).length,
          )))
    ) {
      return { ok: false, error: { kind: 'invalid-shape' } };
    }
    for (const list of [e.pinned, e.excluded]) {
      if (
        list !== undefined &&
        (!Array.isArray(list) ||
          list.some((i) => typeof i !== 'number' || i < 0 || i >= (e.tokens as unknown[]).length))
      ) {
        return { ok: false, error: { kind: 'invalid-shape' } };
      }
    }
  }

  const entryById = new Map<string, { tokens: unknown[] }>();
  for (const e of entries) {
    entryById.set(e.id as string, e as { tokens: unknown[] });
  }

  const markings = d.markings as { entryId: unknown; ranges: unknown }[];
  for (const m of markings) {
    if (typeof m.entryId !== 'string' || !entryById.has(m.entryId)) {
      return { ok: false, error: { kind: 'invalid-reference' } };
    }
    const entry = entryById.get(m.entryId)!;
    if (!Array.isArray(m.ranges)) {
      return { ok: false, error: { kind: 'invalid-shape' } };
    }
    for (const r of m.ranges as { start: unknown; end: unknown }[]) {
      if (
        typeof r.start !== 'number' ||
        typeof r.end !== 'number' ||
        r.start > r.end ||
        r.start < 0 ||
        r.end >= entry.tokens.length
      ) {
        return { ok: false, error: { kind: 'invalid-shape' } };
      }
    }
  }

  const sessions = d.sessions as { entryId: unknown }[];
  for (const s of sessions) {
    if (typeof s.entryId !== 'string' || !entryById.has(s.entryId)) {
      return { ok: false, error: { kind: 'invalid-reference' } };
    }
  }

  return {
    ok: true,
    data: {
      schemaVersion: 1,
      entries: d.entries as AppData['entries'],
      markings: d.markings as AppData['markings'],
      sessions: d.sessions as AppData['sessions'],
      settings: d.settings as AppData['settings'],
    },
  };
}

/**
 * 別の場所(Safari とホーム画面のアプリなど)のデータを今のデータに足す。
 * 同じ ID の英文は今の方を残し、無い英文だけをマーキング・学習履歴ごと加える。設定は今のまま
 */
export function mergeAppData(current: AppData, incoming: AppData): { data: AppData; added: number } {
  const known = new Set(current.entries.map((e) => e.id));
  const newEntries = incoming.entries.filter((e) => !known.has(e.id));
  const newIds = new Set(newEntries.map((e) => e.id));
  const knownSessions = new Set(current.sessions.map((s) => s.id));
  return {
    added: newEntries.length,
    data: {
      ...current,
      entries: [...current.entries, ...newEntries],
      markings: [...current.markings, ...incoming.markings.filter((m) => newIds.has(m.entryId))],
      sessions: [
        ...current.sessions,
        ...incoming.sessions.filter((s) => newIds.has(s.entryId) && !knownSessions.has(s.id)),
      ],
    },
  };
}
