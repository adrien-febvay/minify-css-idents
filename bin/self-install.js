const fs = require('fs');
const path = require('path');
const resolve = (...pathname) => path.resolve(__dirname, '..', ...pathname);

function updateDir(path) {
  return typeof path === 'string' ? path.replace(/^(\.?\/)?/, '../../') : path;
}

let { name, version, main, exports: entrypoints } = JSON.parse(fs.readFileSync(resolve('package.json')));
main = updateDir(main);
if (entrypoints && typeof entrypoints === 'object') {
  for (const name in entrypoints) {
    entrypoints[name] = updateDir(entrypoints[name]);
  }
}
const package = JSON.stringify({ name, version, main, exports: entrypoints }, null, 2);

const dir = resolve('node_modules', name);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'package.json'), package, 'utf-8');
