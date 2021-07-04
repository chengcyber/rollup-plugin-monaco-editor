import fs from 'fs';
import { packageJsonPath } from './paths';
import _ from 'lodash';
import execa from 'execa';

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
      `yarn add --dev monaco-editor@${version} --ignore-scripts`,
      {
        stdio: 'inherit',
      }
    );
  }

  dispose() {
    execa.commandSync(
      `yarn add --dev monaco-editor@${this._initial_version} --ignore-scripts`
    );
  }
}

const monacoEditorInstaller = new MonacoEditorInstaller();

export { monacoEditorInstaller };
