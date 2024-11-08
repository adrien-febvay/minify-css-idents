const { join, relative, resolve } = require('path');

function dirs(syntaxPath, srcIndex) {
  const testDir = relative(join(__dirname, '..'), __dirname);
  const syntaxDir = relative(__dirname, syntaxPath);
  const srcDir = `${testDir}/${syntaxDir}/src`;
  const context = resolve(`${srcDir}${srcIndex}`);
  const entry = resolve(`${context}/index.js`);
  const filename = resolve(`${testDir}/${syntaxDir}/dist1/styles.map.json`);
  const localIdentContext = resolve(`${srcDir}1`);
  const path = resolve(`${testDir}/${syntaxDir}/dist${srcIndex}`);
  return { context, entry, filename, localIdentContext, path };
}

module.exports = dirs;