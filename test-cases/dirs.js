const { join, relative, resolve } = require('path');

const MAP = 'styles.map.json';

function dirs(syntaxPath, srcIndex, distIndex = srcIndex) {
  const context = resolve(`${syntaxPath}/src${srcIndex}`);
  const entry = resolve(`${context}/index.js`);
  const inputMap = srcIndex == 2 && `../dist1/${MAP}`;
  const localIdentContext = resolve(`${syntaxPath}/src1`);
  const path = resolve(`${syntaxPath}/dist${distIndex}`);
  const outputMap = srcIndex && MAP;
  return { context, entry, inputMap, localIdentContext, path, outputMap };
}

module.exports = dirs;