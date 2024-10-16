const cp = require('child_process');
const fs = require('fs');
const json5 = require('json5');
const os = require('os');
const path = require('path');
const { rimrafSync } = require('rimraf');

const resolve = (...args) => path.resolve(__dirname, ...args);
const { join, sep } = path;

function empty(path) {
  rimrafSync(join(path, '**', '*').split(sep).join('/'), { glob: true });
}

function kill(status, ...args) {
  if (args.length) {
    console.error(...args);
  }
  remove(tmpDir);
  process.exit(status);
}

function ignoreError(fn) {
  try {
    fn()
  } catch (error) {}
}

function prepareDir(path) {
  fs.mkdirSync(path, { recursive: true });
  empty(path);
}

function processFile(tmpDir, outDir, filename, license) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(join(tmpDir, filename), 'utf-8')
    const writeStream = fs.createWriteStream(join(outDir, filename), 'utf-8')
    writeStream.write(license);
    readStream.pipe(writeStream);
    writeStream.on('error', reject);
    writeStream.on('finish', resolve);
  });
}

async function processFiles(tmpDir, outDir, license) {
  let outDirCreated = false;
  for (const entry of fs.readdirSync(tmpDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      outDirCreated = processFiles(join(tmpDir, entry.name), join(outDir, entry.name), license) || outDirCreated;
    } else {
      if (/\.(js|d\.ts)$/.test(entry.name)) {
        if (!outDirCreated) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        const outFile = join(outDir, entry.name);
        fs.writeFileSync(outFile, license, 'utf-8');
        await processFile(tmpDir, outDir, entry.name, license);
      }
      remove(tmpDir, entry.name);
    }
  }
  remove(tmpDir);
}

function readdirIfExists(path) {
  try {
    return fs.readdirSync(path);
  } catch (error) {
    if (error instanceof Error && error.code === 'ENOENT') {
      return null;
    } else {
      throw error;
    }
  }
}

function remove(...path) {
  ignoreError(() => fs.rmSync(join(...path), { recursive: true }));
}

function resolveOutDir() {
  const tsconfig = json5.parse(fs.readFileSync(resolve('tsconfig.json'), 'utf-8'));
  if (!tsconfig || typeof tsconfig !== 'object' || tsconfig instanceof Array) {
    throw new Error('Invalid tsconfig.json file in project root');
  } else if (tsconfig.extends) {
    throw new Error('No support for "extends" option in tsconfig.json yet');
  } else if (!tsconfig.compilerOptions?.outDir) {
    throw new Error('The tsconfig.json file must have a "compilerOptions.outDir" option');
  } else {
    return resolve(tsconfig.compilerOptions.outDir);
  }
}

function tsc(tmpDir) {
  const npx = /^win\d+$/.test(process.platform) ? 'npx.cmd' : 'npx';
  const args = ['tsc', '--outDir', tmpDir];
  console.log('>', npx, ...args);
  console.log();
  const { error, status } = cp.spawnSync(npx, args, { shell: true, stdio: 'inherit' });
  const count = readdirIfExists(tmpDir)?.length;
  if (error) {
    kill(500, `\x1b[31mTSC error \x1b[33m${error.code}\x1b[0m`);
  } else if (status) {
    kill(status, `\x1b[31mTSC exited with status \x1b[33m${status}\x1b[0m`);
  } else if (count) {
    const plural = count > 1 ? 's' : '';
    console.log(`TSC generated \x1b[33m${count}\x1b[0m file${plural}`);
  } else {
    console.error(`\x1b[31mTSC generated no files\x1b[0m`);
  }
}

let packageName;
try {
  packageName = JSON.parse(fs.readFileSync('package.json', 'utf-8')).name;
} catch (cause) {
  kill(500, 'Failure to get version from package.json\n ', String(cause));
}
const tmpDir = fs.mkdtempSync(join(os.tmpdir(), `${packageName}-`));
prepareDir(tmpDir);
const outDir = resolveOutDir();
prepareDir(outDir);
tsc(tmpDir);
const license = `/*! *****************************************************************************
${fs.readFileSync(resolve('LICENSE.txt'), 'utf-8').replace(/\n$/, '')}
***************************************************************************** */
`;
processFiles(tmpDir, outDir, license).catch((error) => kill(1, error));
