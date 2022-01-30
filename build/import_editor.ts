import glob from 'glob';
import path from 'path';
import fs from 'fs-extra';

const customFeatureLabels: Record<string, string> = {
  'vs/editor/browser/controller/coreCommands': 'coreCommands',
  'vs/editor/contrib/caretOperations/caretOperations': 'caretOperations',
  'vs/editor/contrib/caretOperations/transpose': 'transpose',
  'vs/editor/contrib/colorPicker/colorDetector': 'colorDetector',
  'vs/editor/contrib/rename/onTypeRename': 'onTypeRename',
  'vs/editor/contrib/gotoSymbol/link/goToDefinitionAtPosition': 'gotoSymbol',
  'vs/editor/contrib/snippet/snippetController2': 'snippets',
  'vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess':
    'gotoLine',
  'vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess':
    'quickCommand',
  'vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess':
    'quickOutline',
  'vs/editor/standalone/browser/quickAccess/standaloneHelpQuickAccess':
    'quickHelp',
};

export { generate };

async function generate(projectFolder: string, distFolder: string) {
  if (!projectFolder) {
    throw new Error('projectFolder is required');
  }
  if (!distFolder) {
    throw new Error('distFolder is required');
  }
  const monacoEditorPath = path.resolve(
    projectFolder,
    'node_modules/monaco-editor'
  );
  console.log('generate languages...')
  await generateLanguages();
  console.log('generate features...')
  await generateFeatures();

  async function generateLanguages() {
    return Promise.all([getBasicLanguages(), getAdvancedLanguages()]).then(
      ([basicLanguages, advancedLanguages]) => {
        basicLanguages.sort(strcmp);
        advancedLanguages.sort(strcmp);

        let i = 0,
          len = basicLanguages.length;
        let j = 0,
          lenJ = advancedLanguages.length;
        let result = [];
        while (i < len || j < lenJ) {
          if (i < len && j < lenJ) {
            if (basicLanguages[i].label === advancedLanguages[j].label) {
              let entry = [];
              entry.push(basicLanguages[i].entry);
              entry.push(advancedLanguages[j].entry);
              result.push({
                label: basicLanguages[i].label,
                entry: entry,
                worker: advancedLanguages[j].worker,
              });
              i++;
              j++;
            } else if (basicLanguages[i].label < advancedLanguages[j].label) {
              result.push(basicLanguages[i]);
              i++;
            } else {
              result.push(advancedLanguages[j]);
              j++;
            }
          } else if (i < len) {
            result.push(basicLanguages[i]);
            i++;
          } else {
            result.push(advancedLanguages[j]);
            j++;
          }
        }

        const code = `//
// THIS IS A GENERATED FILE. PLEASE DO NOT EDIT DIRECTLY.
//
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.languagesArr = void 0;
exports.languagesArr = ${JSON.stringify(result, null, '  ')
          .replace(/"label":/g, 'label:')
          .replace(/"entry":/g, 'entry:')
          .replace(/"worker":/g, 'worker:')
          .replace(/"id":/g, 'id:')
          .replace(/"/g, "'")};
`;
        fs.outputFileSync(
          path.join(distFolder, 'languages.js'),
          code.replace(/\r\n/g, '\n')
        );
      }
    );
  }

  function strcmp(a: any, b: any) {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  }

  function generateFeatures(): void {
    const skipImports = [
      'vs/editor/browser/widget/codeEditorWidget',
      'vs/editor/browser/widget/diffEditorWidget',
      'vs/editor/browser/widget/diffNavigator',
      'vs/editor/common/standaloneStrings',
      'vs/editor/contrib/tokenization/tokenization',
      'vs/editor/editor.all',
      'vs/base/browser/ui/codicons/codiconStyles',
      'vs/editor/contrib/gotoSymbol/documentSymbols',
    ];

    let features: string[] = [];
    const files =
      fs
        .readFileSync(
          path.join(monacoEditorPath, 'esm/vs/editor/edcore.main.js')
        )
        .toString() +
      fs
        .readFileSync(
          path.join(monacoEditorPath, 'esm/vs/editor/editor.all.js')
        )
        .toString();
    files.split(/\r\n|\n/).forEach((line) => {
      const m = line.match(/import '([^']+)'/);
      if (m) {
        const tmp = path.posix.join('vs/editor', m[1]).replace(/\.js$/, '');
        if (skipImports.indexOf(tmp) === -1) {
          features.push(tmp);
        }
      }
    });

    let result: { label: string; entry: any }[] = features.map((feature) => {
      return {
        label:
          customFeatureLabels[feature] || path.basename(path.dirname(feature)),
        entry: feature,
      };
    });

    result.sort((a, b) => {
      const labelCmp = strcmp(a.label, b.label);
      if (labelCmp === 0) {
        return strcmp(a.entry, b.entry);
      }
      return labelCmp;
    });

    for (let i = 0; i < result.length; i++) {
      if (i + 1 < result.length && result[i].label === result[i + 1].label) {
        if (typeof result[i].entry === 'string') {
          result[i].entry = [result[i].entry];
        }
        result[i].entry.push(result[i + 1].entry);
        result.splice(i + 1, 1);
      }
    }

    const code = `//
// THIS IS A GENERATED FILE. PLEASE DO NOT EDIT DIRECTLY.
//
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.featuresArr = void 0;
exports.featuresArr = ${JSON.stringify(result, null, '  ')
      .replace(/"label":/g, 'label:')
      .replace(/"entry":/g, 'entry:')
      .replace(/"/g, "'")};
`;
    fs.outputFileSync(
      path.join(distFolder, 'features.js'),
      code.replace(/\r\n/g, '\n')
    );
  }

  async function getBasicLanguages(): Promise<
    { label: string; entry: string }[]
  > {
    return new Promise((resolve, reject) => {
      glob(
        './node_modules/monaco-editor/esm/vs/basic-languages/*/*.contribution.js',
        { cwd: projectFolder },
        (err, files) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(
            files.map((file) => {
              const entry = file
                .substring('./node_modules/monaco-editor/esm/'.length)
                .replace(/\.js$/, '');
              const label = path
                .basename(file)
                .replace(/\.contribution\.js$/, '');
              return {
                label: label,
                entry: entry,
              };
            })
          );
        }
      );
    });
  }

  async function readAdvancedLanguages(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      glob(
        './node_modules/monaco-editor/esm/vs/language/*/monaco.contribution.js',
        { cwd: projectFolder },
        (err, files) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(
            files
              .map((file) =>
                file.substring(
                  './node_modules/monaco-editor/esm/vs/language/'.length
                )
              )
              .map((file) =>
                file.substring(
                  0,
                  file.length - '/monaco.contribution.js'.length
                )
              )
          );
        }
      );
    });
  }

  async function getAdvancedLanguages(): Promise<
    { label: string; entry: string; worker: { id: string; entry: string } }[]
  > {
    return readAdvancedLanguages().then((languages) => {
      let result = [];
      for (const lang of languages) {
        let shortLang = lang === 'typescript' ? 'ts' : lang;
        const entry = `vs/language/${lang}/monaco.contribution`;
        checkFileExists(entry);
        const workerId = `vs/language/${lang}/${shortLang}Worker`;
        checkFileExists(workerId);
        const workerEntry = `vs/language/${lang}/${shortLang}.worker`;
        checkFileExists(workerEntry);
        result.push({
          label: lang,
          entry: entry,
          worker: {
            id: workerId,
            entry: workerEntry,
          },
        });
      }
      return result;
    });

    function checkFileExists(moduleName: string) {
      const filePath = path.join(monacoEditorPath, 'esm', `${moduleName}.js`);
      if (!fs.existsSync(filePath)) {
        console.error(`Could not find ${filePath}.`);
        process.exit(1);
      }
    }
  }
}
