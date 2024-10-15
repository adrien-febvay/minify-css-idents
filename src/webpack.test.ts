import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { relative, resolve as legacyResolve } from 'path';

const root = legacyResolve(__dirname, '..');
const resolve = (...path: string[]) => relative(root, legacyResolve(root, ...path));

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

const expectedIdentMap = `{
  "styles.css/alpha": "a",
  "styles.css/beta": "b",
  "styles.css/gamma": "c",
  "styles.css/delta": "d"
}
`;

describe('Check Webpack compilation output', () => {
  it('Build package', () => {
    expect(() => run('npm run build')).not.toThrow();
  });

  it('Build test/src1', () => {
    expect(() => run('npm run pretest-case:src1')).not.toThrow();
  });

  it('Build test/src2', () => {
    expect(() => run('npm run pretest-case:src2')).not.toThrow();
  });

  it('Ident map is correct', () => {
    expect(readFileSync(resolve('test/dist1/css/styles.map.json'), 'utf-8')).toBe(expectedIdentMap);
  });

  it('CSS module is correct', () => {
    const expected = JSON.parse(expectedIdentMap.replace(/styles\.css\//g, ''));
    const received = JSON.parse(run('node test/dist2'));
    expect(received).toStrictEqual(expected);
  });
});
