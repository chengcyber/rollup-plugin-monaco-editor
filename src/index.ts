import path from 'path';
import type { Plugin } from 'rollup';
import { languagesArr } from './languages';
import { featuresArr } from './features';
import { isWrappedId, FEAT_SUFFIX, LANG_SUFFIX, wrapId } from './helpers';

type LanguageConfig = typeof languagesArr[number];
type LanguagesById = {
  [K in LanguageConfig['label']]: LanguageConfig & { label: K };
};
const languagesById = languagesArr.reduce<LanguagesById>((languagesById, language) => {
  (languagesById as any)[language.label] = language;
  return languagesById;
}, {} as LanguagesById);
type LanguageKeys = keyof LanguagesById;

type FeatureConfig = typeof featuresArr[number];
type FeaturesById = {
  [K in FeatureConfig['label']]: FeatureConfig & { label: K }
}
const featuresById = featuresArr.reduce<FeaturesById>((featuresById, feature) => {
  (featuresById as any)[feature.label] = feature;
  return featuresById;
 }, {} as FeaturesById );
 type FeatureKeys = keyof FeaturesById;



const MONACO_ENTRY_RE = /monaco-editor[/\\]esm[/\\]vs[/\\]editor[/\\]editor.(api|main)/;
const MONACO_LANG_RE = /monaco-editor[/\\]esm[/\\]vs[/\\]language[/\\]/;
const MONACO_BASE_WORKER_RE = /monaco-editor[/\\]esm[/\\]vs[/\\]base[/\\]worker[/\\]defaultWorkerFactory/;

const EDITOR_MODULE = {
  label: 'editorWorkerService',
  entry: undefined,
  worker: {
    id: 'vs/editor/editor',
    entry: 'vs/editor/editor.worker',
  },
};

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

function getFeaturesIds<T extends string, R extends FeatureKeys>(userFeatures: T[]): R[] {
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
  languages?: LanguageKeys[];
  features?: FeatureKeys[];
  esm?: boolean;
  pathPrefix?: string;
}

function monaco(options: MonacoPluginOptions = {}): Plugin {
  let languages = options.languages || Object.keys(languagesById) as LanguageKeys[];
  let features = getFeaturesIds((options.features || []));
  let isESM = false;
  if ('esm' in options) {
    isESM = !!options.esm;
  }
  const pathPrefix = options.pathPrefix || '';

  const languageConfigs = coalesce(languages.map(id => languagesById[id]));
  const featureConfigs = coalesce(features.map(id => featuresById[id]));

  type MonacoModules = (
    | typeof languageConfigs[number]
    | typeof featureConfigs[number]
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

  return {
    name: 'monaco',
    options(inputOptions) {
      const mc = inputOptions.moduleContext;
      if ('function' === typeof mc) {
        // func
        inputOptions.moduleContext = (id) => {
          if (id.indexOf('node_modules/monaco-editor') >= 0) {
              return 'self';
          }
          return mc(id);
        }
      } else if (mc && 'object' === typeof mc) {
        // { id: string }
        inputOptions.moduleContext = (id) => {
          if (id.indexOf('node_modules/monaco-editor') >= 0) {
              return 'self';
          }
          return mc[id];
        }
      } else {
        // nullish
        inputOptions.moduleContext = (id) => {
          if (id.indexOf('node_modules/monaco-editor') >= 0) {
              return 'self';
          }
          return undefined;
        }
      }
      return inputOptions;
    },
    buildStart() {
      for (const [_label, relativePath] of Object.entries(workerPaths)) {
        this.emitFile({
          type: 'chunk',
          id: require.resolve(relativePath),
          fileName: relativePath,
        });
      }
    },
    resolveId(importee, _importer) {
      const isFeatureProxy = isWrappedId(importee, FEAT_SUFFIX);
      const isLanguageProxy = isWrappedId(importee, LANG_SUFFIX);
      if (isFeatureProxy || isLanguageProxy) {
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
          .map(id => `import ${JSON.stringify(id)}`)
          .join(';\n');
        return `${featureImports}`;
      }
      if (isWrappedId(id, LANG_SUFFIX)) {
        const languageImportIds = languagePaths.map(importPath =>
          resolveMonacoPath(importPath)
        );
        const languageImports = languageImportIds
          .map(id => `import ${JSON.stringify(id)}`)
          .join(';\n');
        return `${languageImports}`;
      }
      return null;
    },
    transform(code, id) {
      if (id.startsWith('\0')) {
        return null;
      }
      // fix circular deps issue
      if (MONACO_LANG_RE.test(id)) {
        // FIXME: better use magic string to remove import
        code = code.replace(
          /import\s['"]\.\.\/\.\.\/editor\/editor\.api\.js['"];?/,
          ''
        );
        return {
          code,
          map: null,
        };
      }
      // fix worker import esm
      if (isESM && MONACO_BASE_WORKER_RE.test(id)) {
        code = code.replace(
          'return new Worker(globals.MonacoEnvironment.getWorkerUrl(workerId, label));',
          `return new Worker(globals.MonacoEnvironment.getWorkerUrl(workerId, label), { type: 'module' });`
        );
        return {
          code,
          map: null,
        };
      }
      if (MONACO_ENTRY_RE.test(id)) {
        // const refId = this.emitFile({
        //   type: 'chunk',
        //   id: wrapId(id, LANG_SUFFIX),
        //   importer: id,
        //   implicitlyLoadedAfterOneOf: [id],
        // });
        const arr = [
          ...(globals
            ? Object.keys(globals).map(
                key => `self[${JSON.stringify(key)}] = ${globals[key]};`
              )
            : []),
          `import ${JSON.stringify(wrapId(id, FEAT_SUFFIX))};`,
          code,
          `import(${JSON.stringify(wrapId(id, LANG_SUFFIX))});`,
        ];
        return {
          code: arr.join('\n'),
          map: null,
        };
      }
      return null;
    },
  };
}
