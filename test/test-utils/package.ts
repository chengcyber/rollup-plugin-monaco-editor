import fs from 'fs';
import { packageJsonPath } from './paths';
import _ from 'lodash';
import execa from 'execa';

const args = [
  '--regsitry=https://registry.npmjs.org',
  '--no-save',
  '--ignore-scripts',
  'no-package-lock',
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
    execa.commandSync(
      `npm install monaco-editor@${version} ${args.join(' ')}`,
      {
        stdio: 'inherit',
      }
    );
  }

  dispose() {
    execa.commandSync(
      `npm install monaco-editor@${this._initial_version} ${args.join(' ')}`
    );
  }
}

const monacoEditorInstaller = new MonacoEditorInstaller();

export { monacoEditorInstaller };
