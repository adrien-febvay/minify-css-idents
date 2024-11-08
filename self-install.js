const fs = require('fs');
const path = require('path');
const resolve = (...pathname) => path.resolve(__dirname, ...pathname);

const { name, version, main } = JSON.parse(fs.readFileSync(resolve('package.json')));
const dir = resolve('node_modules', name);
const package = JSON.stringify({ name, version, main: `../../${main}`}, null, 2);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'package.json'), package, 'utf-8');
