import path from 'path';
import fs from 'fs-extra';
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import postcssUrl from 'postcss-url';
import monaco from '../dist/rollup-plugin-monaco-editor.esm';

export default {
  input: path.resolve(__dirname, './index.js'),
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    postcss({
      plugins: [
        postcssUrl({
          url: (asset) => {
            if (!/\.ttf$/.test(asset.url)) return asset.url;
            const distPath = path.join(process.cwd(), 'dist');
            const distFontsPath = path.join(distPath, 'fonts');
            fs.ensureDirSync(distFontsPath);
            const targetFontPath = path.join(distFontsPath, asset.pathname);
            fs.copySync(asset.absolutePath, targetFontPath);
            const relativePath = path.relative(process.cwd(), targetFontPath);
            const publicPath = '/';
            return `${publicPath}${relativePath}`;
          },
        }),
      ],
    }),
    monaco({
      // languages: ['json'],
    }),
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
