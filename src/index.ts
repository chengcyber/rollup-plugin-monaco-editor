import path from 'path';
import { promises as fs } from 'fs';
import { EmitFile, Plugin } from 'rollup';
import { languagesArr } from './languages';
import { featuresArr } from './features';
import { isWrappedId, FEAT_SUFFIX, wrapId } from './helpers';
import { slash } from './slash';

type LanguageConfig = typeof languagesArr[number];
type LanguagesById = {
  [K in LanguageConfig['label']]: LanguageConfig & { label: K };
};
const languagesById = languagesArr.reduce<LanguagesById>(
  (languagesById, language) => {
    (languagesById as any)[language.label] = language;
    return languagesById;
  },
  {} as LanguagesById
);
type LanguageKey = keyof LanguagesById;

type FeatureConfig = typeof featuresArr[number];
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
          // return new Worker(globals.MonacoEnvironment.getWorkerUrl(workerId, label));
          // FIXME: use this.parse to handle this
          modifiedCode = code.replace(
            /return new Worker\(globals\.MonacoEnvironment\.getWorkerUrl\(workerId, label\)\);/g,
            `return new Worker(globals.MonacoEnvironment.getWorkerUrl(workerId, label), { type: 'module' });`
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
        return modifiedCode;
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
      if (MONACO_ENTRY_RE.test(id)) {
        hasMonacoEntry = true;
        // emit workers
        emitWorkerChunks(this.emitFile);

        let arr = [`import ${JSON.stringify(wrapId(id, FEAT_SUFFIX))};`, code];

        // append languages code to editor.api
        const languageImportIds = languagePaths.map(importPath =>
          resolveMonacoPath(importPath)
        );
        const languageCodes = await Promise.all(
          languageImportIds.map(async importId => {
            let c = (await fs.readFile(importId)).toString();
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
            // 3. import('./foo') -> import('$relative/foo');
            const relative = path.relative(
              path.dirname(id),
              path.dirname(importId)
            );
            c = c.replace(/import\('\.\//, `import('${relative}/`);
            return c;
          })
        );

        arr = arr.concat(languageCodes);

        return {
          code: arr.join('\n'),
          map: null,
        };
      }
      return null;
    },
  };
}
