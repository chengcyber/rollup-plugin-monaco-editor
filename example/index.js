import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export const initMonaco = () => {
  const $root = document.getElementById('root');
  monaco.editor.create($root, {
    value: '// type your code...',
    language: 'json',
  });

  const $yaml = document.getElementById('yaml');
  monaco.editor.create($yaml, {
    value: '// type your yaml code...',
    language: 'yaml',
  });
};
