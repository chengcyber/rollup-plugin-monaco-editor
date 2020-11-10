import path from 'path';
import monaco from '../src';
import { rollup } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';

describe('basic', () => {
  it('works', async () => {
    const bundle = await rollup({
      input: path.resolve(__dirname, 'fixtures/basic.js'),
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
  }, 60000);

  it('should not emit when no monaco-editor entry', async () => {
    const bundle = await rollup({
      input: path.resolve(__dirname, 'fixtures/no-monaco-editor.js'),
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
  });
});
