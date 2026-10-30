/**
 * 自分で登録した題材に添付する図(IELTS Task 1 のグラフなど)。
 * 端末の保存容量に収まるよう、読み込み時に縮小して data URL にする。
 */

/** 縮小の段階(長い辺のピクセル数と画質)。大きすぎるときは次の段階で作り直す */
const STEPS = [
  { maxSide: 1400, quality: 0.85 },
  { maxSide: 1100, quality: 0.75 },
  { maxSide: 800, quality: 0.65 },
];
/** これより大きい画像は保存しない(data URL の文字数) */
export const MAX_FIGURE_LENGTH = 450_000;

const FIGURE_DATA_URL = /^data:image\/(png|jpeg|webp|gif|svg\+xml);/;

/** 添付した図として扱ってよい文字列か(インポートしたファイルの検証に使う) */
export function isFigureDataUrl(value: unknown): value is string {
  return typeof value === 'string' && FIGURE_DATA_URL.test(value) && value.length <= MAX_FIGURE_LENGTH * 2;
}

/** SVG のソースを img で表示できる data URL にする */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 長い辺が maxSide を超えないように縮めた大きさ */
export function fitSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 画像ファイルを縮小して data URL にする。読めない・大きすぎるときは null。
 * 透明な部分は白で塗る(グラフの PNG が黒背景にならないように)。
 */
export async function imageFileToFigure(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return null;
  }
  if (!img.naturalWidth || !img.naturalHeight) return null;

  for (const { maxSide, quality } of STEPS) {
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    // WebP に対応していないブラウザでは PNG が返るので、そのときは JPEG にする
    let url = canvas.toDataURL('image/webp', quality);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_FIGURE_LENGTH) return url;
  }
  return null;
}
