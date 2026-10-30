/** 自分専用版(claude.ai のアーティファクトとして配布し、端末間で同期する)かどうか */
export const IS_PERSONAL = import.meta.env.VITE_TARGET === 'personal';
/** みんな向けの IELTS 版(内蔵題材はバンド6.0〜6.5のモデルアンサー。保存は端末内だけ) */
export const IS_EVERYONE = import.meta.env.VITE_TARGET === 'everyone';
/** 内蔵の題材(教材ライブラリ・タブ・全文和訳・型)を出すかどうか */
export const HAS_PRESETS = IS_PERSONAL || IS_EVERYONE;
