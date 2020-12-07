import { parse, ImportSpecifier } from 'es-module-lexer';

const REPLACE_IMPORT_REG = /\s*(['"])(.*)\1\s*$/m;

export async function transformImports(
  code: string,
  cb: (specifier: string) => string
) {
  let imports: ImportSpecifier[] = [];
  try {
    [imports] = parse(code);
  } catch (e) {
    // no-catch
  }

  imports = imports
    .filter(imp => {
      // import.meta.url skip
      if (imp.d === -2) {
        return false;
      }
      if (imp.d > -1) {
        return !!code.substring(imp.s, imp.e).match(REPLACE_IMPORT_REG);
      }
      return true;
    })
    .reverse();

  for (const imp of imports) {
    let spec = code.substring(imp.s, imp.e);
    if (imp.d > -1) {
      const importSpecifierMatch = spec.match(REPLACE_IMPORT_REG);
      spec = importSpecifierMatch![2];
    }
    let replaced = cb(spec);
    if (replaced !== spec) {
      if (imp.d > -1) {
        replaced = JSON.stringify(replaced);
      }
      code = code.slice(0, imp.s) + replaced + code.slice(imp.e);
    }
  }

  return code;
}
