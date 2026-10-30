import { describe, expect, it } from 'vitest';
import { buildExportFile, mergeAppData, parseImportFile } from './exportImport';
import type { AppData } from '../types';

const validData: AppData = {
  schemaVersion: 1,
  entries: [{ id: 'e1', createdAt: '2026-01-01T00:00:00.000Z', tokens: ['hi', 'there'] }],
  markings: [{ entryId: 'e1', ranges: [{ start: 0, end: 0 }] }],
  sessions: [{ id: 's1', entryId: 'e1', timestamp: '2026-01-02T00:00:00.000Z', totalQuestions: 1, correctCount: 1 }],
  settings: { quizRatio: 0.5 },
};

describe('buildExportFile / parseImportFile round trip', () => {
  it('round-trips valid data', () => {
    const file = buildExportFile(validData);
    const result = parseImportFile(JSON.stringify(file));
    expect(result).toEqual({ ok: true, data: validData });
  });

  it('round-trips an attached figure and rejects one that is not an image', () => {
    const withFigure = { ...validData, entries: [{ ...validData.entries[0]!, figure: 'data:image/webp;base64,AAAA' }] };
    expect(parseImportFile(JSON.stringify(buildExportFile(withFigure)))).toEqual({ ok: true, data: withFigure });
    const bad = { ...validData, entries: [{ ...validData.entries[0]!, figure: 'javascript:alert(1)' }] };
    expect(parseImportFile(JSON.stringify(buildExportFile(bad)))).toEqual({ ok: false, error: { kind: 'invalid-shape' } });
  });

  it('rejects unparseable JSON', () => {
    const result = parseImportFile('{not json');
    expect(result).toEqual({ ok: false, error: { kind: 'parse' } });
  });

  it('rejects an unsupported schema version', () => {
    const file = { ...buildExportFile(validData), schemaVersion: 2 };
    const result = parseImportFile(JSON.stringify(file));
    expect(result).toEqual({ ok: false, error: { kind: 'unsupported-version' } });
  });

  it('rejects a marking range whose end is out of bounds for its entry', () => {
    const file = buildExportFile({
      ...validData,
      markings: [{ entryId: 'e1', ranges: [{ start: 0, end: 99 }] }],
    });
    const result = parseImportFile(JSON.stringify(file));
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-shape' } });
  });

  it('rejects a marking that references a non-existent entry', () => {
    const file = buildExportFile({
      ...validData,
      markings: [{ entryId: 'does-not-exist', ranges: [{ start: 0, end: 0 }] }],
    });
    const result = parseImportFile(JSON.stringify(file));
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-reference' } });
  });

  it('rejects a session that references a non-existent entry', () => {
    const file = buildExportFile({
      ...validData,
      sessions: [{ id: 's1', entryId: 'does-not-exist', timestamp: '2026-01-01T00:00:00.000Z', totalQuestions: 1, correctCount: 1 }],
    });
    const result = parseImportFile(JSON.stringify(file));
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-reference' } });
  });

  it('rejects data missing required fields', () => {
    const result = parseImportFile(JSON.stringify({ schemaVersion: 1, data: {} }));
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-shape' } });
  });

  it('round-trips an entry with a title', () => {
    const withTitle: AppData = {
      ...validData,
      entries: [{ ...validData.entries[0]!, title: 'Greeting' }],
    };
    const file = buildExportFile(withTitle);
    const result = parseImportFile(JSON.stringify(file));
    expect(result).toEqual({ ok: true, data: withTitle });
  });

  it('accepts an entry with no title (old-shape import)', () => {
    const file = buildExportFile(validData);
    const result = parseImportFile(JSON.stringify(file));
    expect(result.ok).toBe(true);
  });

  it('rejects an entry whose title is not a string', () => {
    const file = buildExportFile(validData);
    const raw = JSON.parse(JSON.stringify(file));
    raw.data.entries[0].title = 123;
    const result = parseImportFile(JSON.stringify(raw));
    expect(result).toEqual({ ok: false, error: { kind: 'invalid-shape' } });
  });
});

describe('mergeAppData', () => {
  const other: AppData = {
    ...validData,
    entries: [
      { id: 'e1', createdAt: '2026-01-01T00:00:00.000Z', tokens: ['changed'] },
      { id: 'e2', createdAt: '2026-01-03T00:00:00.000Z', tokens: ['new', 'one'] },
    ],
    markings: [
      { entryId: 'e1', ranges: [] },
      { entryId: 'e2', ranges: [{ start: 1, end: 1 }] },
    ],
    sessions: [{ id: 's2', entryId: 'e2', timestamp: '2026-01-04T00:00:00.000Z', totalQuestions: 1, correctCount: 0 }],
    settings: { quizRatio: 0.9 },
  };

  it('adds only the entries this side does not have, with their markings and sessions', () => {
    const { data, added } = mergeAppData(validData, other);
    expect(added).toBe(1);
    expect(data.entries.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(data.entries[0]!.tokens).toEqual(['hi', 'there']);
    expect(data.markings).toEqual([...validData.markings, other.markings[1]]);
    expect(data.sessions.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(data.settings.quizRatio).toBe(0.5);
  });

  it('adds nothing when merging the same data twice', () => {
    const once = mergeAppData(validData, other).data;
    expect(mergeAppData(once, other)).toEqual({ data: once, added: 0 });
  });
});
