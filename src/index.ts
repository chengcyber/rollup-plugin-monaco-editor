import path from 'path';
import fs, { promises as fsp } from 'fs';
import { EmitFile, Plugin } from 'rollup';
import { init } from 'es-module-lexer';
import { isWrappedId, FEAT_SUFFIX, wrapId } from './helpers';
import { slash } from './slash';
import { makeLegal } from './makeLegal';
import { transformImports } from './transformImports';
import semver from 'semver';
import * as recast from 'recast';
import MagicString from 'magic-string';

const builders = recast.types.builders;

/**
 * Features
 */
type FeaturesArr = {
  label: string;
  entry: string | string[];
}[];
let featuresArr: FeaturesArr = [];
/**
 * Languages
 */
type LanguagesArr = {
  label: string;
  entry: string | string[];
  worker?: {
    id: string;
    entry: string;
  };
}[];
let languagesArr: LanguagesArr = [];

initMonaco();
/**
 * initialize monaco
 */
function initMonaco() {
  const monacoEditorPackageJsonPath = require.resolve(
    `monaco-editor/package.json`
  );

  try {
    initMonacoByMetadata({
      monacoEditorPackageJsonPath,
    });
  } catch {
    initMonacoLegacy({
      monacoEditorPackageJsonPath,
    });
  }
}

interface InitMonacoByMetadataParams {
  monacoEditorPackageJsonPath: string;
}

function initMonacoByMetadata({
  monacoEditorPackageJsonPath,
}: InitMonacoByMetadataParams) {
  const metadataFilepath = path.join(
    path.dirname(monacoEditorPackageJsonPath),
    'esm/metadata.js'
  );
  const metadata = require(metadataFilepath);
  if (!metadata.features || !metadata.languages) {
    throw new Error('features or languages not found in metadata');
  }
  featuresArr = metadata.features;
  languagesArr = metadata.languages;
}

interface InitMonacoLegacyParams {
  monacoEditorPackageJsonPath: string;
}

/**
 * initialize monaco-editor < 0.31.0
 */
function initMonacoLegacy({
  monacoEditorPackageJsonPath,
}: InitMonacoLegacyParams) {
  const { version: monacoEditorVersion } = JSON.parse(
    fs.readFileSync(monacoEditorPackageJsonPath, 'utf-8')
  );
  const {
    versionMapping,
  }: {
    versionMapping: Record<string, string[]>;
  } = require('../plugin/versionMapping');

  const monacoEditorVersionMappingEntries = Object.entries(versionMapping);
  let resolvedMonacoEditorVersion: string | null = null;
  for (const [
    editorVersion,
    monacoEditorVersionRanges,
  ] of monacoEditorVersionMappingEntries) {
    if (
      monacoEditorVersionRanges.some(range => {
        return semver.satisfies(monacoEditorVersion, range);
      })
    ) {
      resolvedMonacoEditorVersion = editorVersion;
      break;
    }
  }
  if (!resolvedMonacoEditorVersion) {
    throw new Error(
      `[rollup-plugin-monaco-editor] current monaco-editor version(${monacoEditorVersion}) are not supported, please file a issue at
https://github.com/chengcyber/rollup-plugin-monaco-editor/issues`
    );
  }
  const editorInfoVersionFolder = `../plugin/out/${resolvedMonacoEditorVersion.replace(
    /\*/g,
    '_x_'
  )}`;
  const featureJS = require(`${editorInfoVersionFolder}/features.js`) as {
    featuresArr: FeaturesArr;
  };
  featuresArr = featureJS.featuresArr;
  const languagesJS = require(`${editorInfoVersionFolder}/languages.js`) as {
    languagesArr: LanguagesArr;
  };
  languagesArr = languagesJS.languagesArr;
}

type FeatureConfig = FeaturesArr[number];
type FeaturesById = {
  [K in FeatureConfig['label']]: FeatureConfig & { label: K };
};
const featuresById = featuresArr.reduce<FeaturesById>(
  (featuresById, feature) => {
    (featuresById as any)[feature.label] = feature;
    return featuresById;
  },
  {} as FeaturesById
);
type FeatureKey = keyof FeaturesById;

type LanguageConfig = LanguagesArr[number];
type LanguagesById = {
  [K in LanguageConfig['label']]: LanguageConfig & { label: K };
};
type LanguageKey = keyof LanguagesById;

const languagesById = languagesArr.reduce<LanguagesById>(
  (languagesById, language) => {
    (languagesById as any)[language.label] = language;
    return languagesById;
  },
  {} as LanguagesById
);

const MONACO_ENTRY_RE = /monaco-editor[/\\]esm[/\\]vs[/\\]editor[/\\]editor.(api|main)/;
// const MONACO_LANG_RE = /monaco-editor[/\\]esm[/\\]vs[/\\]language[/\\]/;
const MONACO_BASE_WORKER_RE = /monaco-editor[/\\]esm[/\\]vs[/\\]base[/\\]worker[/\\]defaultWorkerFactory/;

const EDITOR_MODULE = {
  label: 'editorWorkerService',
  entry: undefined,
  worker: {
    id: 'vs/editor/editor',
    entry: 'vs/editor/editor.worker',
  },
} as const;

/**
 * Return a resolved path for a given Monaco file.
 */
function resolveMonacoPath(filePath: string) {
  return require.resolve(getMonacoRelativePath(filePath));
}
function getMonacoRelativePath(filePath: string) {
  return path.join('monaco-editor/esm', `${filePath}.js`);
}

function coalesce<T extends any>(array: T[]) {
  return array.filter(Boolean);
}

function flatArr<T extends any>(items: T[]) {
  return items.reduce((acc, item) => {
    if (Array.isArray(item)) {
      return ([] as any[]).concat(acc).concat(item);
    }
    return ([] as any[]).concat(acc).concat([item]);
  }, [] as any[]);
}

function getFeaturesIds<T extends string, R extends FeatureKey>(
  userFeatures: T[]
): R[] {
  function notContainedIn(arr: string[]) {
    return (element: string) => arr.indexOf(element) === -1;
  }
  let featuresIds: unknown[] = [];
  if (userFeatures.length) {
    const excludedFeatures = userFeatures
      .filter(f => f[0] === '!')
      .map(f => f.slice(1));
    if (excludedFeatures.length) {
      featuresIds = Object.keys(featuresById).filter(
        notContainedIn(excludedFeatures)
      );
    } else {
      featuresIds = userFeatures;
    }
  } else {
    featuresIds = Object.keys(featuresById);
  }
  return featuresIds as R[];
}

export default monaco;

export interface MonacoPluginOptions {
  languages?: LanguageKey[];
  features?: FeatureKey[];
  /**
   * Affects how web worker are imported
   * @default rollup.outputOptions.format is esm or es
   */
  esm?: boolean;
  /**
   * Path prefixes worker url
   * @default rollup.outputOptions.dir with a leading slash
   */
  pathPrefix?: string;
}

function monaco(options: MonacoPluginOptions = {}): Plugin {
  let languages =
    options.languages || (Object.keys(languagesById) as LanguageKey[]);
  let features = getFeaturesIds(options.features || []);
  let isESM = false;
  if ('esm' in options) {
    isESM = !!options.esm;
  }

  const languageConfigs = coalesce(languages.map(id => languagesById[id]));
  const featureConfigs = coalesce(features.map(id => featuresById[id]));

  type MonacoModules = (
    | LanguageConfig
    | FeatureConfig
    | typeof EDITOR_MODULE
  )[];
  const modules = ([EDITOR_MODULE] as MonacoModules)
    .concat(languageConfigs)
    .concat(featureConfigs);
  const workers: { label: string; id: string; entry: string }[] = [];
  modules.forEach(module => {
    if ('worker' in module && module.worker) {
      workers.push({
        label: module.label,
        id: module.worker.id,
        entry: module.worker.entry,
      });
    }
  });

  const languagePaths = flatArr(
    coalesce(languageConfigs.map(language => language.entry))
  );
  const featurePaths = flatArr(
    coalesce(featureConfigs.map(feature => feature.entry))
  );

  const workerPaths: Record<string, string> = {};

  for (const { label, entry } of workers) {
    workerPaths[label] = getMonacoRelativePath(entry);
  }

  let workerChunksEmited: boolean = false;
  function emitWorkerChunks(emitFile: EmitFile) {
    if (workerChunksEmited) {
      return;
    }
    workerChunksEmited = true;
    for (const [_label, relativePath] of Object.entries(workerPaths)) {
      emitFile({
        type: 'chunk',
        id: require.resolve(relativePath),
        fileName: relativePath,
      });
    }
  }

  let hasMonacoEntry = false;

  return {
    name: 'monaco',
    options(inputOptions) {
      const ret = { ...inputOptions };
      const mc = inputOptions.moduleContext;
      if ('function' === typeof mc) {
        // func
        ret.moduleContext = id => {
          if (slash(id).indexOf('node_modules/monaco-editor') >= 0) {
            return 'self';
          }
          return mc(id);
        };
      } else if (mc && 'object' === typeof mc) {
        // { id: string }
        ret.moduleContext = id => {
          if (slash(id).indexOf('node_modules/monaco-editor') >= 0) {
            return 'self';
          }
          return mc[id];
        };
      } else {
        // nullish
        ret.moduleContext = id => {
          if (slash(id).indexOf('node_modules/monaco-editor') >= 0) {
            return 'self';
          }
          return undefined;
        };
      }
      return ret;
    },
    async buildStart() {
      await init;
    },
    renderChunk(code, chunk, outputOptions) {
      if (!hasMonacoEntry) {
        return null;
      }
      let modifiedCode: string | null = null;
      const containsMonacoEntryModule = Array.from(
        this.getModuleIds()
      ).some(id => MONACO_ENTRY_RE.test(id));
      const isWorkerChunk = Object.values(workerPaths).includes(chunk.fileName);
      const { format } = outputOptions;
      if (containsMonacoEntryModule && !isWorkerChunk) {
        if (format === 'es' || isESM) {
          /**
           * use new Worker(xxx, { type: 'module' }) when esm
           * Case 1: new Worker(globals.MonacoEnvironment.getWorkerUrl(workerId, label));
           * Case 2: new Worker(workerUrl, { name: label });
           */
          modifiedCode = code.replace(
            /(?<!\/\/.*)new Worker\((.*)\);/g,
            ($0, $1) => {
              const ast = recast.parse($0);
              const expressionStatement = ast.program.body[0];
              const args = expressionStatement.expression.arguments;
              if (args.length === 1) {
                args.push(
                  builders.objectExpression([
                    builders.property(
                      'init',
                      builders.identifier('type'),
                      builders.literal('module')
                    ),
                  ])
                );
              } else if (args.length === 2) {
                const secondArg = args[1];
                if (secondArg.type === 'ObjectExpression') {
                  secondArg.properties.push(
                    builders.property(
                      'init',
                      builders.identifier('type'),
                      builders.literal('module')
                    )
                  );
                }
              }
              const modifiedCode = recast.print(ast).code;
              return modifiedCode;
            }
          );
        }
        if (chunk.isEntry) {
          // inject globals
          let pathPrefix = options.pathPrefix;
          if (!pathPrefix) {
            const { dir } = outputOptions;
            if (!dir) {
              this.warn('rollup outputOptions.dir is missing');
            } else {
              pathPrefix = dir;
              if (!pathPrefix.startsWith('/')) {
                pathPrefix = `/${pathPrefix}`;
              }
            }
          }
          if (!pathPrefix) {
            pathPrefix = '';
          }
          const globals: Record<string, string> = {
            MonacoEnvironment: `(function (paths) {
            function stripTrailingSlash(str) {
              return str.replace(/\\/$/, '');
            }
            return {
              getWorkerUrl: function (moduleId, label) {
                var pathPrefix = ${JSON.stringify(pathPrefix)};
                var result = (pathPrefix ? stripTrailingSlash(pathPrefix) + '/' : '') + paths[label];
                if (/^((http:)|(https:)|(file:)|(\\/\\/))/.test(result)) {
                  var currentUrl = String(window.location);
                  var currentOrigin = currentUrl.substr(0, currentUrl.length - window.location.hash.length - window.location.search.length - window.location.pathname.length);
                  if (result.substring(0, currentOrigin.length) !== currentOrigin) {
                    var js = '/*' + label + '*/importScripts("' + result + '");';
                    var blob = new Blob([js], { type: 'application/javascript' });
                    return URL.createObjectURL(blob);
                  }
                }
                return result;
              }
            };
          })(${JSON.stringify(workerPaths, null, 2)})`,
          };
          const arr = [
            ...(globals
              ? Object.keys(globals).map(
                  key => `self[${JSON.stringify(key)}] = ${globals[key]};`
                )
              : []),
            modifiedCode || code,
          ];

          modifiedCode = arr.join('\n');
        }
      }
      if (modifiedCode) {
        const map = new MagicString(modifiedCode).generateMap({
          hires: true,
        });
        return {
          code: modifiedCode,
          map,
        };
      }
      return null;
    },
    resolveId(importee, _importer) {
      const isFeatureProxy = isWrappedId(importee, FEAT_SUFFIX);
      if (isFeatureProxy) {
        return importee;
      }
      return null;
    },
    load(id) {
      if (isWrappedId(id, FEAT_SUFFIX)) {
        const featureImportIds = featurePaths.map(importPath =>
          resolveMonacoPath(importPath)
        );
        const featureImports = featureImportIds
          .map(id => `import ${JSON.stringify(id)};`)
          .join('\n');
        return `${featureImports}`;
      }
      return null;
    },
    async transform(code, id) {
      if (id.startsWith('\0')) {
        return null;
      }
      // other plugins may generate virtual module from monaco editor entry
      if (!path.isAbsolute(id)) {
        return null;
      }
      if (MONACO_ENTRY_RE.test(id)) {
        hasMonacoEntry = true;
        // emit workers
        emitWorkerChunks(this.emitFile);

        let arr = [`import ${JSON.stringify(wrapId(id, FEAT_SUFFIX))};`, code];

        // append languages code to editor.api
        const languageImportIds = languagePaths.map(importPath =>
          resolveMonacoPath(importPath)
        );
        let hasImportRegisterLanguage = false;
        const languageCodes = await Promise.all(
          languageImportIds.map(async importId => {
            let c = (await fsp.readFile(importId)).toString();
            // FIXME: use this.parse to handle this
            // 1. fix circular dependency
            c = c.replace(
              /import\s['"]\.\.\/\.\.\/editor\/editor\.api\.js['"];?/,
              ''
            );
            // 2. fillers/monaco-editor-core is same with editor.api, remove it
            c = c.replace(
              /import\s+.*from ['"]\.\/fillers\/monaco-editor-core\.js['"];?/,
              ''
            );
            // 2.2 dedup import * as monaco_editor_core_star from "../../editor/editor.api.js";
            c = c.replace(
              /import\s+\*\s+as\s+monaco_editor_core_star\s+from\s+["']\.\.\/\.\.\/editor\/editor\.api\.js["'];?/,
              ''
            );
            // 3. rename getMode to getXXXMode
            c = c.replace(/getMode\(\)/g, () => {
              const languageFilename = slash(importId)
                .split('/')
                .slice(-3, -1)
                .join('_');
              const langName = makeLegal(languageFilename);
              return `get${langName}Mode()`;
            });
            // 4. dedup import { registerLanguage } from '../_.contribution.js';
            c = c.replace(
              /import\s+{\s+registerLanguage\s+}\s+from\s+['"]\.\.\/_\.contribution\.js['"];?/,
              () => {
                hasImportRegisterLanguage = true;
                return '';
              }
            );
            // 5. import('./foo') -> import('$relative/foo');
            c = await transformImports(c, spec => {
              if (spec[0] === '.') {
                const _spec = slash(
                  path.relative(
                    path.dirname(id),
                    path.resolve(path.dirname(importId), spec)
                  )
                );
                return _spec;
              }
              return spec;
            });

            return c;
          })
        );

        if (hasImportRegisterLanguage) {
          const basicContribPath = resolveMonacoPath(
            'vs/basic-languages/_.contribution'
          );
          let basicContribCode = await fsp.readFile(basicContribPath, 'utf-8');
          // fillers/monaco-editor-core is same with editor.api, remove it
          basicContribCode = basicContribCode.replace(
            /import\s+.*from ['"]\.\/fillers\/monaco-editor-core\.js['"];?/,
            ''
          );
          arr = arr.concat(basicContribCode);
        }

        arr = arr.concat(languageCodes);

        const transformedCode: string = arr.join('\n');
        const map = new MagicString(transformedCode).generateMap({
          hires: true,
        });

        return {
          code: transformedCode,
          map,
        };
      }
      return null;
    },
  };
}
