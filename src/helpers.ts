export const FEAT_SUFFIX = '?monaco-features';
export const LANG_SUFFIX = '?monaco-languages';

type SUFFIX = typeof FEAT_SUFFIX | typeof LANG_SUFFIX;

export const isWrappedId = (id: string, suffix: SUFFIX) => id.endsWith(suffix);
export const wrapId = (id: string, suffix: SUFFIX) => `\0${id}${suffix}`;
export const unwrapId = (id: string, suffix: SUFFIX) =>
  id.slice(1, -suffix.length);
