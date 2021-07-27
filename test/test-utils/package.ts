import fs from 'fs';
import { packageJsonPath, projectFolder } from './paths';
import _ from 'lodash';
import execa from 'execa';

const args = [
  '--regsitry=https://registry.npmjs.org',
  '--no-save',
  '--ignore-scripts',
  '--no-lockfile',
];

class MonacoEditorInstaller {
  private _initial_version: string;
  constructor() {
    const json = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    this._initial_version = _.get(json, ['devDependencies', 'monaco-editor']);
    if (!this._initial_version) {
      throw new Error('get project monaco-editor version failed');
    }
  }

  install(version: string) {
    try {
      execa.commandSync(
        `npm install monaco-editor@${version} ${args.join(' ')}`,
        {
          stdio: 'inherit',
        }
      );
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  dispose() {
    execa.commandSync(`pnpm install`, {
      cwd: projectFolder,
    });
  }
}

const monacoEditorInstaller = new MonacoEditorInstaller();

export { monacoEditorInstaller };
