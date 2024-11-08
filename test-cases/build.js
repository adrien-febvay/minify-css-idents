const { spawnSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const { join, relative } = require('path');

const [syntaxIndex, buildIndex] = process.argv.slice(-2);

function existsSync(path) {
  try {
    statSync(path);
    return true;
  } catch (error) {
    if (error instanceof Error && error.code === 'ENOENT') {
      return false;
    } else {
      kill(500, error);
    }
  }
}

function kill(code, ...message) {
  console.error(...message);
  process.exit(code);
}

function run(...cmd) {
  const chunks = cmd.map((chunk) => chunk.trim().split(/\s+/)).flat(1);
  const args = chunks.slice(1);
  const exe = chunks[0] === 'npm' && /^win\d+$/.test(process.platform) ? 'npm.cmd' : cmd[0].trim().replace(/\s.*/, '');
  const { error, status } = spawnSync(exe, args, { shell: true, stdio: 'inherit' });
  if (error) {
    throw error;
  } else if (status) {
    throw new Error(`${exe} exited with status ${status}`);
  }
}

const testDir = relative(join(__dirname, '..'), __dirname);
let syntaxDir;
for (entry of readdirSync(testDir)) {
  if (/^syntax-/.test(entry) && entry.slice(7).startsWith(`${syntaxIndex}-`)) {
    syntaxDir = entry;
    break;
  }
}

const file = `./${testDir}/${syntaxDir}/webpack.build${buildIndex}.config.js`;
if (!syntaxDir || !buildIndex) {
  kill(400, 'Bad test case references, syntax: npm run build-test-case [syntaxIndex] [buildIndex]');
} else if (!existsSync(file)) {
  kill(404, `Bad test case references, file not found: ${file}`);
} else {
  module.exports = run(`npx webpack --config ${file}`);
}
