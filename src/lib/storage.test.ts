import { beforeEach, describe, expect, it } from 'vitest';
import { INITIAL_DATA, loadData, saveData } from './storage';
import type { AppData } from '../types';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the initial data when nothing is stored', () => {
    expect(loadData()).toEqual(INITIAL_DATA);
  });

  it('returns the initial data when the stored value is corrupted JSON', () => {
    localStorage.setItem('eiwaku_app_data_v1', 'not valid json{');
    expect(loadData()).toEqual(INITIAL_DATA);
  });

  it('returns the initial data when the stored value has the wrong shape', () => {
    localStorage.setItem('eiwaku_app_data_v1', JSON.stringify({ foo: 'bar' }));
    expect(loadData()).toEqual(INITIAL_DATA);
  });

  it('round-trips a saved AppData through loadData', () => {
    const data: AppData = {
      schemaVersion: 1,
      entries: [{ id: 'e1', createdAt: '2026-01-01T00:00:00.000Z', tokens: ['hi'] }],
      markings: [{ entryId: 'e1', ranges: [{ start: 0, end: 0 }] }],
      sessions: [],
      settings: { quizRatio: 0.4 },
    };
    saveData(data);
    expect(loadData()).toEqual(data);
  });
});
