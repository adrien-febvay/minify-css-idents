import { spawnSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { resolve as legacyResolve } from 'path';

const root = legacyResolve(__dirname, '..');
const resolve = (...path: string[]) => legacyResolve(root, ...path);

function run(...cmd: [string, ...string[]]) {
  const chunks = cmd.map((chunk) => chunk.trim().split(/\s+/)).flat(1);
  const args = chunks.slice(1);
  const exe = chunks[0] === 'npm' && /^win\d+$/.test(process.platform) ? 'npm.cmd' : cmd[0].trim().replace(/\s.*/, '');
  const { error, status, ...pipes } = spawnSync(exe, args, { shell: true });
  const stderr = pipes.stderr.toString().replace(/\n/g, '\n  ');
  if (error) {
    throw error;
  } else if (status) {
    throw new Error(`${exe} exited with status ${status}\n  ${stderr}`);
  } else if (stderr) {
    throw new Error(`${exe} output an error\n  ${stderr}`);
  } else {
    return pipes.stdout.toString();
  }
}

const expectedIdentMapKeys = ['___styles_1__alpha', '___styles_1__beta', '___styles_2__delta', '___styles_2__gamma'];
const expectedIdentMapValues = ['a', 'b', 'c', 'd'];

const expectedMinifiedCss = `
.a {
  display: none;
}

.b {
  display: none;
}

.c {
  display: none;
}

.d {
  display: none;
}
`.replace(/\s+|;/g, '');

const expectedUnminifiedCss = `
.___styles__alpha {
  display: none;
}

.___styles__beta {
  display: none;
}

.___styles__gamma {
  display: none;
}

.___styles__delta {
  display: none;
}
`.trim();

describe('Check Webpack compilation - Prerquisites', () => {
  it('The package builds', () => {
    expect(() => run('npm run build')).not.toThrow();
  });

  it('The package is mocked in node_modules', () => {
    expect(() => run('node bin/self-install')).not.toThrow();
  });
});

for (const entry of readdirSync('test-cases')) {
  if (/^syntax-\d+-/.test(entry)) {
    const [, syntaxIndex = '', ...syntaxNameChunks] = entry.split('-');
    const syntaxName = syntaxNameChunks.join('-');
    if (syntaxName.endsWith('-without-plugin')) {
      testCaseWithoutPlugin(entry, syntaxIndex, syntaxName);
    } else {
      testCaseWithPlugin(entry, syntaxIndex, syntaxName);
    }
  }
}

function testCaseWithPlugin(entry: string, syntaxIndex: string, syntaxName: string) {
  describe(`Check Webpack compilation - Case ${syntaxIndex}: ${syntaxName}`, () => {
    let resultingIdentMap: unknown;

    it(`Project test-cases/${entry}/src1 builds`, () => {
      expect(() => run(`node test-cases/build -- ${syntaxIndex} 1`)).not.toThrow();
    });

    it('Ident map is correct', () => {
      resultingIdentMap = readIdentMapSync(entry, 1);
      expect(typeof resultingIdentMap).toBe('object');
      expect(resultingIdentMap).not.toBe(null);
      const keys = resultingIdentMap && Object.keys(resultingIdentMap).sort();
      const values = resultingIdentMap && Object.values(resultingIdentMap).sort();
      expect(keys).toStrictEqual(expectedIdentMapKeys);
      expect(values).toStrictEqual(expectedIdentMapValues);
    });

    it(`Project test-cases/${entry}/src2 builds`, () => {
      expect(() => run(`node test-cases/build ${syntaxIndex} 2`)).not.toThrow();
    });

    it('Ident map is still correct', () => {
      expect(readIdentMapSync(entry, 2)).toStrictEqual(resultingIdentMap);
    });

    it('Resulting CSS module is correct', () => {
      const resultingEntries: [string, unknown][] = resultingIdentMap != null ? Object.entries(resultingIdentMap) : [];
      const expectedEntries = resultingEntries.map(([key, value]) => [key.replace(/.*_/, ''), value]);
      const expected: unknown = expectedEntries && Object.fromEntries(expectedEntries);
      const received = JSON.parse(run(`node test-cases/${entry}/dist2`));
      expect(received).toStrictEqual(expected);
    });
  });
}

function testCaseWithoutPlugin(entry: string, syntaxIndex: string, syntaxName: string) {
  describe(`Check Webpack compilation - Case ${syntaxIndex}: ${syntaxName}`, () => {
    it(`Project test-cases/${entry}/src builds on production mode`, () => {
      expect(() => run(`node test-cases/build -- ${syntaxIndex} 1`)).not.toThrow();
    });

    it('Output CSS file is correct on production mode', () => {
      expect(readCssFileSync(entry, 1)).toBe(expectedMinifiedCss);
    });

    it(`Project test-cases/${entry}/src builds on development mode`, () => {
      expect(() => run(`node test-cases/build -- ${syntaxIndex} 2`)).not.toThrow();
    });

    it('Output CSS file is correct on development mode', () => {
      expect(readCssFileSync(entry, 2)).toBe(expectedUnminifiedCss);
    });
  });
}

function readCssFileSync(entry: string, index: number) {
  return readFileSync(resolve('test-cases', entry, `dist${index}/main.min.css`), 'utf-8')
    .replace(/\/\*(.|\n)*?\*\//g, '')
    .trim();
}

function readIdentMapSync(entry: string, buildIndex: number) {
  return JSON.parse(readFileSync(resolve('test-cases', entry, `dist${buildIndex}/styles.map.json`), 'utf-8'));
}
