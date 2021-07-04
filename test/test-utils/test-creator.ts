import path from 'path';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import { monacoEditorInstaller } from './package';
import { projectFolder, testFolder } from './paths';
export interface CreateTestParmas {
  monacoEditorVersion: string;
}

afterAll(() => {
  monacoEditorInstaller.dispose();
});

export const createTest = ({ monacoEditorVersion }: CreateTestParmas) => {
  describe(`monaco-editor ${monacoEditorVersion} - basic`, () => {
    let monaco: any = null;
    beforeAll(() => {
      return new Promise<void>(async (resolve, reject) => {
        console.log(`[start] test monaco-editor ${monacoEditorVersion}`);
        // prepare monaco-editor
        monacoEditorInstaller.install(monacoEditorVersion);
        try {
          const monacoIndexPath = path.resolve(projectFolder, 'src/index.ts');
          delete require.cache[monacoIndexPath];
          monaco = await import('../../src').then(m => m.default);
        } catch (e) {
          console.error(e.message);
          reject(e);
        }
        resolve();
      });
    });
    afterAll(() => {
      console.log(`[end] test monaco-editor ${monacoEditorVersion}`);
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

      const { output } = await bundle.generate({
        exports: 'auto',
        format: 'esm',
        dir: 'dist',
        sourcemap: false,
      });

      let isContainEditorWorker = false;
      let isContainJsonWorker = false;
      const editorWorker = 'monaco-editor/esm/vs/editor/editor.worker.js';
      const jsonWorker = 'monaco-editor/esm/vs/language/json/json.worker.js';

      for (const { fileName } of output) {
        if (fileName === editorWorker) {
          isContainEditorWorker = true;
        }
        if (fileName === jsonWorker) {
          isContainJsonWorker = true;
        }
      }

      expect(isContainEditorWorker).toBe(true);
      expect(isContainJsonWorker).toBe(true);
      done();
    }, 60000);

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

      const { output } = await bundle.generate({
        exports: 'auto',
        format: 'esm',
        dir: 'dist',
        sourcemap: false,
      });

      let isContainEditorWorker = false;
      let isContainJsonWorker = false;
      const editorWorker = 'monaco-editor/esm/vs/editor/editor.worker.js';
      const jsonWorker = 'monaco-editor/esm/vs/language/json/json.worker.js';

      for (const { fileName } of output) {
        if (fileName === editorWorker) {
          isContainEditorWorker = true;
        }
        if (fileName === jsonWorker) {
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

      const { output } = await bundle.generate({
        exports: 'auto',
        format: 'esm',
        dir: 'dist',
        sourcemap: false,
      });

      expect(output.length).toBe(1);
      expect(output[0].fileName).toBe('no-monaco-editor.js');
      done();
    });
  });
};
