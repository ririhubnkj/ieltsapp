import { describe, expect, it } from 'vitest';
import { fitSize, isFigureDataUrl, svgDataUrl } from './figureImage';

describe('fitSize', () => {
  it('shrinks the longer side to the limit and keeps the aspect ratio', () => {
    expect(fitSize(2800, 1400, 1400)).toEqual({ width: 1400, height: 700 });
    expect(fitSize(1000, 3000, 1500)).toEqual({ width: 500, height: 1500 });
  });

  it('never enlarges a small image', () => {
    expect(fitSize(600, 400, 1400)).toEqual({ width: 600, height: 400 });
  });
});

describe('isFigureDataUrl', () => {
  it('accepts image data URLs only', () => {
    expect(isFigureDataUrl('data:image/webp;base64,AAAA')).toBe(true);
    expect(isFigureDataUrl(svgDataUrl('<svg/>'))).toBe(true);
    expect(isFigureDataUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(isFigureDataUrl('https://example.com/a.png')).toBe(false);
    expect(isFigureDataUrl(42)).toBe(false);
  });
});
