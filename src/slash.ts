/**
 * Copy from https://github.com/sindresorhus/slash/blob/master/index.js
 * with MIT license
 */
export const slash = (path: string) => {
  const isExtendedLengthPath = /^\\\\\?\\/.test(path);
  const hasNonAscii = /[^\u0000-\u0080]+/.test(path);

  if (isExtendedLengthPath || hasNonAscii) {
    return path;
  }

  return path.replace(/\\/g, '/');
};
