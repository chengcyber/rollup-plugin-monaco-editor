import { createTest } from './test-utils/test-creator';

const monacoEditorVersions = [
  '0.21.2',
  '0.22.3',
  '0.24.0',
  '0.25.0',
  '0.26.1',
  '0.27.0',
  '0.29.1',
  '0.30.1',
  '0.31.1',
];

for (const monacoEditorVersion of monacoEditorVersions) {
  createTest({
    monacoEditorVersion,
  });
}
