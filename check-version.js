const cp = require('child_process');
const fs = require('fs');

function kill(status, ...args) {
  if (args.length) {
    console.error(...args);
  }
  process.exit(status);
}

let version;
try {
  version = JSON.parse(fs.readFileSync('package.json', 'utf-8')).version;
} catch (cause) {
  kill(500, 'Failure to get version from package.json\n ', String(cause));
}

const { error, status, ...res } = cp.spawnSync('git', 'tag --points-at HEAD'.split(' '), { shell: true });
const stderr = res.stderr ? res.stderr.toString() : null;
const stdout = res.stdout ? res.stdout.toString() : null;

const tags = stdout?.trim().split(/\s+/);

if (stderr) {
  console.error(stderr);
}

if (error) {
  kill(500, `Git error ${error.code}:${error.message}`);
} else if (status) {
  kill(500, `Git returned status ${status}`);
} else if (stderr) {
  kill(500, 'Git unknown error');
} else if (!tags) {
  kill(500, 'Tags could not be retrieved');
} else if (!tags.length) {
  kill(400, 'No tag found on this commit');
} else if (!tags.includes(`v${version}`)) {
  kill(400, `Tag v${version} not found`);
}
