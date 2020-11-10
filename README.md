# rollup-plugin-monaco-editor

> A rollup plugin to import monaco editor

# Environment

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
  output: {
    format: 'es',
    dir: 'dist',
  },
  // ...other config
  plugins: [
    // ...other plugins
    // handle .css files
    postcss(),
    monaco({
      languages: ['json'],
    }),
    resolve(),
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

# LICENSE

MIT
