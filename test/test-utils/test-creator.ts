import path from 'path';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import slash from 'slash';
import tempy from 'tempy';
import { testFolder } from './paths';
import monaco from '../../src';
import execa from 'execa';
export interface CreateTestParams {
  monacoEditorVersion: string;
}

// afterAll(() => {
//   monacoEditorInstaller.dispose();
// });

jest.setTimeout(60000);

export const createTest = ({ monacoEditorVersion }: CreateTestParams) => {
  describe(`monaco-editor ${monacoEditorVersion} - basic`, () => {
    let tempDir: string = '';
    beforeAll(async done => {
      tempDir = tempy.directory({
        prefix: 'rollup_plugin_monaco_editor_test',
      });
      console.log(
        `[start] test monaco-editor ${monacoEditorVersion} under ${tempDir}`
      );
      await prepareTest({
        cwd: tempDir,
        monacoEditorVersion,
      });
      done();
    });
    afterAll(() => {
      console.log(
        `[end] test monaco-editor ${monacoEditorVersion} under ${tempDir}`
      );
    });
    beforeEach(() => {
      process.chdir(tempDir);
    });

    it('should work with json', async done => {
      const bundle = await rollup({
        input: path.resolve(testFolder, 'fixtures/basic.js'),
        preserveEntrySignatures: 'strict',
        plugins: [
          monaco({
            // features: [],
            languages: ['json'],
          }),
          postcss(),
          resolve({
            mainFields: [
              'exports',
              'browser:module',
              'browser',
              'module',
              'main',
            ].filter(Boolean),
            extensions: ['.mjs', '.cjs', '.js', '.json'], // Default: [ '.mjs', '.js', '.json', '.node' ]
            // whether to prefer built-in modules (e.g. `fs`, `path`) or local ones with the same names
            preferBuiltins: true, // Default: true
            dedupe: [], // userDefinedRollup.dedupe,
          }),
          commonjs(),
        ],
      });

      const bundled = await bundle.generate({
        exports: 'auto',
        format: 'esm',
        dir: 'dist',
        sourcemap: false,
      });
      expect(bundled).not.toBeNull();
      if (!bundled) {
        return;
      }

      const { output } = bundled;

      let isContainEditorWorker = false;
      let isContainJsonWorker = false;
      const editorWorker = 'monaco-editor/esm/vs/editor/editor.worker.js';
      const jsonWorker = 'monaco-editor/esm/vs/language/json/json.worker.js';

      for (const { fileName } of output) {
        if (isFileNameEqual(fileName, editorWorker)) {
          isContainEditorWorker = true;
        }
        if (isFileNameEqual(fileName, jsonWorker)) {
          isContainJsonWorker = true;
        }
      }

      expect(isContainEditorWorker).toBe(true);
      expect(isContainJsonWorker).toBe(true);
      done();
    });

    it('should work with all languages', async done => {
      const bundle = await rollup({
        input: path.resolve(testFolder, 'fixtures/basic.js'),
        preserveEntrySignatures: 'strict',
        plugins: [
          monaco({
            // features: [],
          }),
          postcss(),
          resolve({
            mainFields: [
              'exports',
              'browser:module',
              'browser',
              'module',
              'main',
            ].filter(Boolean),
            extensions: ['.mjs', '.cjs', '.js', '.json'], // Default: [ '.mjs', '.js', '.json', '.node' ]
            // whether to prefer built-in modules (e.g. `fs`, `path`) or local ones with the same names
            preferBuiltins: true, // Default: true
            dedupe: [], // userDefinedRollup.dedupe,
          }),
          commonjs(),
        ],
      });

      const bundled = await bundle.generate({
        exports: 'auto',
        format: 'esm',
        dir: 'dist',
        sourcemap: false,
      });
      expect(bundled).not.toBeNull();
      if (!bundled) {
        return;
      }

      const { output } = bundled;

      let isContainEditorWorker = false;
      let isContainJsonWorker = false;
      const editorWorker = 'monaco-editor/esm/vs/editor/editor.worker.js';
      const jsonWorker = 'monaco-editor/esm/vs/language/json/json.worker.js';

      for (const { fileName } of output) {
        if (isFileNameEqual(fileName, editorWorker)) {
          isContainEditorWorker = true;
        }
        if (isFileNameEqual(fileName, jsonWorker)) {
          isContainJsonWorker = true;
        }
      }

      expect(isContainEditorWorker).toBe(true);
      expect(isContainJsonWorker).toBe(true);

      // TODO: test dedup import { registerLanguage } from '../_.contribution.js'
      // TODO: test relative path resolution
      // TODO: test replaced getMode()
      done();
    }, 60000);

    it('should not emit when no monaco-editor entry', async done => {
      const bundle = await rollup({
        input: path.resolve(testFolder, 'fixtures/no-monaco-editor.js'),
        plugins: [
          monaco({
            // features: [],
            languages: ['json'],
          }),
          postcss(),
          resolve(),
          commonjs(),
        ],
      });

      const bundled = await bundle.generate({
        exports: 'auto',
        format: 'esm',
        dir: 'dist',
        sourcemap: false,
      });
      expect(bundled).not.toBeNull();
      if (!bundled) {
        return;
      }
      const { output } = bundled;

      expect(output.length).toBe(1);
      expect(output[0].fileName).toBe('no-monaco-editor.js');
      done();
    });
  });
};

function isFileNameEqual(a: string, b: string) {
  const _a = slash(a);
  const _b = slash(b);
  return _a === _b;
}

interface IPrepareTestParams {
  cwd: string;
  monacoEditorVersion: string;
}

async function prepareTest({ cwd, monacoEditorVersion }: IPrepareTestParams) {
  const execaOptions: execa.Options = {
    cwd,
    shell: true,
    stdio: 'inherit',
  };
  await execa(`pnpm init -y`, execaOptions);
  await execa(
    `pnpm install monaco-editor@${monacoEditorVersion}`,
    execaOptions
  );
}
