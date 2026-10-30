import { isWordToken } from './tokenize';

export function joinTokens(tokens: string[]): string {
  let result = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const needsSpace = i > 0 && isWordToken(token);
    result += (needsSpace ? ' ' : '') + token;
  }
  return result;
}
