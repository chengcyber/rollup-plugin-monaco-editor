#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const projectFolder = path.resolve(__dirname, '..');
const distFolder = path.resolve(projectFolder, 'dist');
const indexPath = path.resolve(distFolder, 'index.js');

if (!fs.existsSync(indexPath)) {
  console.log(`${indexPath} does not exist`);
  process.exit(1);
}

let code = fs.readFileSync(indexPath, 'utf-8');

code = code.replace(/require\(/g, 'esmRequire(');

code = `${code}
function esmRequire(id) {
  var m = require(id);
  if (m.__esModule && 'default' in m) {
    return m.default;
  }
  return m;
}
`;

fs.writeFileSync(indexPath, code);
