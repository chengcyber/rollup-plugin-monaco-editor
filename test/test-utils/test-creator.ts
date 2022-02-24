import path from 'path';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import slash from 'slash';
import tempy from 'tempy';
import { testFolder } from './paths';
import monaco, { MonacoPluginOptions } from '../../src';
import execa from 'execa';
import { InputOptions } from 'rollup';
export interface CreateTestParams {
  monacoEditorVersion: string;
}

// afterAll(() => {
//   monacoEditorInstaller.dispose();
// });

// loose timeout to 100 secs.
jest.setTimeout(100000);

const getRollupInputOptions = (
  input: string,
  monacoPluginOptions: MonacoPluginOptions = {}
): InputOptions => {
  // The default value of sourcemap is true, disable it to speed up most tests
  if (monacoPluginOptions.sourcemap !== true) {
    monacoPluginOptions.sourcemap = false;
  }
  return {
    input,
    preserveEntrySignatures: 'strict',
    plugins: [
      monaco(monacoPluginOptions),
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
  };
};

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
      const bundle = await rollup(
        getRollupInputOptions(path.resolve(testFolder, 'fixtures/basic.js'), {
          // features: [],
          languages: ['json'],
        })
      );

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
      const bundle = await rollup(
        getRollupInputOptions(path.resolve(testFolder, 'fixtures/basic.js'), {
          // features: [],
        })
      );

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
    });

    it('should not emit when no monaco-editor entry', async done => {
      const bundle = await rollup(
        getRollupInputOptions(
          path.resolve(testFolder, 'fixtures/no-monaco-editor.js'),
          {
            // features: [],
            languages: ['json'],
          }
        )
      );

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

    it('should generate sourcemap correctly', async done => {
      let hasSourcemapBrokenWarn: boolean = false;
      const bundle = await rollup({
        ...getRollupInputOptions(
          path.resolve(testFolder, 'fixtures/basic.js'),
          {
            // features: [],
            languages: ['json'],
            sourcemap: true,
          }
        ),
        onwarn: warning => {
          if (warning.code === 'SOURCEMAP_BROKEN') {
            hasSourcemapBrokenWarn = true;
          }
        },
      });

      const bundled = await bundle.generate({
        exports: 'auto',
        format: 'esm',
        dir: 'dist',
        sourcemap: true,
      });
      expect(bundled).not.toBeNull();
      if (!bundled) {
        return;
      }
      expect(hasSourcemapBrokenWarn).toBe(false);

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
