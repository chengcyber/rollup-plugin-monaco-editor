#!/usr/bin/env ts-node

import tempy from 'tempy';
import execa from 'execa';
import semver from 'semver';
import fs from 'fs-extra';
import path from 'path';

import { versionMatrix } from '../plugin/versionMatrix';

const projectFolder = path.resolve(__dirname, '..');
const WEBPACK_PLUGIN_NAME = 'monaco-editor-webpack-plugin';
const localPluginFolder = path.resolve(projectFolder, 'plugin');
const tempdir = tempy.directory({
  prefix: 'rollup_plugin_monaco_editor_build',
});

main();

async function main() {
  try {
    await generateFeatures();
  } catch (e) {
    console.error(`generate failed ${e.message}`);
  }
}

async function generateFeatures() {
  const { stdout } = execa.commandSync(
    `npm info ${WEBPACK_PLUGIN_NAME} versions`
  );
  const versionsStr = String(stdout)
    .trim()
    .replace(/'/g, `"`);
  const versions = JSON.parse(versionsStr);

  for (const webpackPluginVersionRange of Object.keys(versionMatrix)) {
    const webpackPluginVersion = semver.maxSatisfying(
      versions,
      webpackPluginVersionRange
    );
    if (!webpackPluginVersion) {
      console.warn(
        `${webpackPluginVersionRange} not found in ${versions.join(', ')}`
      );
      continue;
    }

    execa.commandSync(
      `npm install ${WEBPACK_PLUGIN_NAME}@${webpackPluginVersion}`,
      {
        cwd: tempdir,
        shell: true,
        stdio: 'inherit',
      }
    );
    const files = ['features.js', 'languages.js'];
    for (const f of files) {
      const filePath = require.resolve(`${WEBPACK_PLUGIN_NAME}/out/${f}`, {
        paths: [tempdir],
      });
      fs.moveSync(
        filePath,
        path.resolve(
          localPluginFolder,
          'out',
          webpackPluginVersionRange.replace(/\*/g, '_x_'),
          f
        ),
        {
          overwrite: true,
        }
      );
    }
  }
}
