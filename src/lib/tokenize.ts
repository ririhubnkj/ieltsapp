// 8.3 や 1,550 のような数値は1語として扱う(小数点で文が切れないように)
const TOKEN_RE = /\d+(?:[.,]\d+)+|[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*|[^\sA-Za-z0-9]/g;

export function tokenize(raw: string): string[] {
  return raw.match(TOKEN_RE) ?? [];
}

export function isWordToken(token: string): boolean {
  return /[A-Za-z0-9]/.test(token);
}
