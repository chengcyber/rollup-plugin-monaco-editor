# rollup-plugin-monaco-editor

> A rollup plugin to import monaco editor

Online demo: https://chengcyber.github.io/rollup-plugin-monaco-editor/

# Monaco Editor Version

For now, this plugin supports `monaco-editor@^0.21.*`.

The following versions have been tested locally:

- `0.21.2`
- `0.22.3`
- `0.24.0`
- `0.25.0`
- `0.26.1`
- `0.27.0`
- `0.29.1`
- `0.30.1`
- `0.31.1`
- `0.34.0`

# Usage

This plugin should be used with other plugins. including

- `@rollup/plugin-node-resolve`
- `rollup-plugin-postcss` (or other plugin can handle `.css` files)
- `@rollup/plugin-commonjs`

```javascript
// rollup.config.js
import { nodeResolve } from '@rollup/plugin-node-resolve';
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
    nodeResolve(),
    commonjs(),
  ],
};
```

# Plugin Options

Plugin options can be passed in to `rollup-plugin-monaco-editor`. They can be used to generate a smaller editor bundle by selecting only certain languages or only certain editor features:

## `languages`

Type: `string[]`
Default: All available languages depends on the version of `monaco-editor` installed.

Example:

```js
monaco({
  languages: ['json'],
});
monaco({
  languages: ['html', 'css', 'javascript'],
});
```

## `features`

Type: `string`
Default: All available features depends on the version of `monaco-editor` installed.

Example:

```js
monaco({
  features: ['contextmenu'],
});
monaco({
  features: ['rename'],
});
```

## `esm`

Type: `boolean`
Default: `true` if `rollup.outputOptions.format` is `esm` or `es`, otherwise `false`.

## `pathPrefix`

Type: `string`
Default: `rollup.outputOptions.dir` with leading slash.

## `sourcemap`

Type: `boolean`
Default: true

You can set `sourcemap` to `false` to disable generate sourcemap. It makes build faster.

# Example

> NOTE: pnpm@6 is used to manage this package

```
pnpm install
pnpm build
pnpm build:example
pnpm start:example
```

visit `http://localhost:8080` to see the simple demo.

# Development

```
pnpm start
```

# LICENSE

MIT @[chengcyber](https://github.com/chengcyber)
