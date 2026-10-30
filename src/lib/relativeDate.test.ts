import { describe, expect, it } from 'vitest';
import { formatRelativeDate } from './relativeDate';

const now = new Date('2026-01-31T00:00:00.000Z');

describe('formatRelativeDate', () => {
  it('returns 未学習 for null', () => {
    expect(formatRelativeDate(null, now)).toBe('未学習');
  });

  it('returns 今日 for the same day', () => {
    expect(formatRelativeDate('2026-01-31T00:00:00.000Z', now)).toBe('今日');
  });

  it('returns N日前 for a few days ago', () => {
    expect(formatRelativeDate('2026-01-28T00:00:00.000Z', now)).toBe('3日前');
  });

  it('returns Nヶ月前 for a month or more ago', () => {
    expect(formatRelativeDate('2025-11-01T00:00:00.000Z', now)).toBe('3ヶ月前');
  });

  it('returns N年前 for a year or more ago', () => {
    expect(formatRelativeDate('2025-01-31T00:00:00.000Z', now)).toBe('1年前');
  });
});
