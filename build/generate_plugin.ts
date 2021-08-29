#!/usr/bin/env ts-node

import tempy from 'tempy';
import execa from 'execa';
import semver from 'semver';
import path from 'path';

import { versionMapping } from '../plugin/versionMapping';
import { generate } from './import_editor';

const projectFolder = path.resolve(__dirname, '..');
const MONACO_EDITOR_NAME = 'monaco-editor';
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
    `npm info ${MONACO_EDITOR_NAME} versions`
  );
  const versionsStr = String(stdout).trim().replace(/'/g, `"`);
  const versions = JSON.parse(versionsStr);

  for (const editorVersionRange of Object.keys(versionMapping)) {
    const targetEditorVersion = semver.maxSatisfying(
      versions,
      editorVersionRange
    );
    if (!targetEditorVersion) {
      console.warn(`${editorVersionRange} not found in ${versions.join(', ')}`);
      continue;
    }

    execa.commandSync(
      `npm install ${MONACO_EDITOR_NAME}@${targetEditorVersion}`,
      {
        cwd: tempdir,
        shell: true,
        stdio: 'inherit',
      }
    );
    const distFolder = path.resolve(
      localPluginFolder,
      'out',
      editorVersionRange.replace(/\*/g, '_x_')
    );
    await generate(tempdir, distFolder);
  }
}
