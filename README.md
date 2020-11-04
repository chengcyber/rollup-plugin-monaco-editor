# rollup-plugin-monaco-editor

> A rollup plugin to import monaco editor

# Enviroment

- monaco-editor: `0.21.2`

NOTE: different version of `monaco-editor` has different feature definitions. This plugin just tests with `0.21.2` version for now.

# Usage

This plugin should be used with other plugins. including

- `@rollup/plugin-node-resolve`
- `rollup-plugin-postcss` (or other plugin can handle `.css` files)
- `@rollup/plugin-commonjs`

```javascript
// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import postcss from 'rollup-plugin-postcss';
import commonjs from '@rollup/plugin-commonjs';
import monaco from 'rollup-plugin-monaco-editor';

export default {
  // ...other config
  plugins: [
    // ...other plugins
    // handle .css files
    postcss(),
    monaco({
      esm: true, // true if you set output.format is esm
      pathPrefix: '/dist', // mostly same as output.dir with a prefix slash
      languages: ['json'],
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
```

# Example

```
yarn install
yarn build
yarn build:example
yarn start:example
```

visit `http://localhost:8080` to see the simple demo.

# Development

```
yarn start
```

# Known Issues

## Languages won't work when init monaco editor synchronously when format is esm

This is a tricky issue, languages need `monaco` API to register language. For now languages are imported via dynamic import, this leads to the issue if you `create` the monaco editor after importing the monaco module immediately. It might be fixed after the chrome supports top-level await, but i can't find a good solution right now.

# LICENSE

MIT
