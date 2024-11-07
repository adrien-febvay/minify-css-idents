import { spawnSync } from 'child_process';
import { readFileSync, statSync } from 'fs';
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

const expectedIdentMap = `{
  "___styles__alpha": "a",
  "___styles__beta": "b",
  "___styles__gamma": "c",
  "___styles__delta": "d"
}
`;

describe('Check Webpack compilation output', () => {
  it('Build package', () => {
    expect(() => run('npm run build')).not.toThrow();
  });

  it('Build test/src1', () => {
    expect(() => run('npm run pretest-case:src1')).not.toThrow();
  });

  it('Ident map is correct', () => {
    expect(readFileSync(resolve('test/dist1/css/styles.map.json'), 'utf-8')).toBe(expectedIdentMap);
  });

  it('Build test/src2', () => {
    expect(() => run('npm run pretest-case:src2')).not.toThrow();
  });

  it('Ident map is still correct', () => {
    expect(readFileSync(resolve('test/dist1/css/styles.map.json'), 'utf-8')).toBe(expectedIdentMap);
  });

  it('CSS module is correct', () => {
    const expected = JSON.parse(expectedIdentMap.replace(/___styles__/g, ''));
    const received = JSON.parse(run('node test/dist2'));
    expect(received).toStrictEqual(expected);
  });

  it('Build test/src3', () => {
    expect(() => run('npm run pretest-case:src3')).not.toThrow();
  });

  it('Ident map is removed', () => {
    const path = resolve('test/dist1/css/styles.map.json');
    const message = `ENOENT: no such file or directory, stat '${path}'`;
    expect(() => statSync(path)).toThrow(message);
  });
});
