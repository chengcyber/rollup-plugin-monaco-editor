// https://github.com/microsoft/monaco-editor-webpack-plugin#version-matrix
const versionMatrix = {
  '4.*.*': ['0.26.*'],
  '4.0.*': ['0.25.*'],
  '3.*.*': ['0.22.*', '0.23.*', '0.24.*'],
  '2.*.*': ['0.21.*'],
  // FIXME: support these versions
  // '1.9.*': ['0.20.*'],
  // '1.8.*': ['0.19.*'],
  // '1.7.*': ['0.18.*'],
};

module.exports = {
  versionMatrix,
};
