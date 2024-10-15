import type { Compiler } from 'webpack';

import fs from 'fs';
import EventEmitter from 'events';
import { MinifyCssIdents as OriginalMinifyCssIdents } from '.';

class MinifyCssIdents extends OriginalMinifyCssIdents {
  public apply() {
    const compiler = mockCompiler();
    super.apply(compiler);
    return compiler;
  }

  public getContextPath() {
    return this.contextPath;
  }

  public getLastIdent() {
    return this.lastIdent;
  }

  public getIdentMap() {
    return this.identMap;
  }

  public expectIdent(ident: string, key = `test-${ident}`) {
    try {
      expect(this.generateIdent(key)).toBe(ident);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        Error.captureStackTrace(error, MinifyCssIdents.prototype.expectIdent);
      }
      throw error;
    }
  }

  public setLastIdent(lastIndent: string): this {
    this.lastIdent = lastIndent.split('');
    return this;
  }
}

function mockCompiler() {
  const beforeCompile = new FakeHook();
  const afterEmit = new FakeHook();
  const fakeCompiler = { context: 'default-context', hooks: { beforeCompile, afterEmit } };
  return fakeCompiler as Compiler & typeof fakeCompiler;
}

class FakeHook extends EventEmitter {
  public emit() {
    return super.emit('emit');
  }

  public get listener() {
    return this.listeners('emit')[0];
  }

  public tap(_type: string, callback: () => void) {
    this.on('emit', callback);
  }
}

const someOptions = {
  context: 'some-context',
  exclude: ['some-ident', 'some-ident-prefix-*'],
  filename: 'some-filename',
  mapIndent: 4,
  mode: 'extend-map',
  startIdent: 'some-ident',
} as const;

jest.mock('fs');
const mockedFs = jest.requireMock<{ [Key in keyof typeof fs]: jest.Mock }>('fs');

let consoleWarnSpy: jest.SpyInstance<void, Parameters<Console['warn']>, unknown>;

beforeAll(() => {
  consoleWarnSpy = jest.spyOn(console, 'warn');
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Check MinifyCssIdents plugin and loader', () => {
  it('Options are defaulted', () => {
    const minifyCssIdents = new MinifyCssIdents();
    expect(minifyCssIdents.options).toMatchObject({
      context: null,
      exclude: [],
      excludePrefix: ['ad'],
      filename: null,
      mapIndent: 2,
      mode: 'default',
      startIdent: null,
    });
    minifyCssIdents.apply();
    expect(minifyCssIdents.getContextPath()).toBe('default-context');
  });

  it('Options are resolved', () => {
    const minifyCssIdents = new MinifyCssIdents(someOptions);
    expect(minifyCssIdents.options).toMatchObject({
      ...someOptions,
      exclude: ['some-ident'],
      excludePrefix: ['some-ident-prefix-'],
    });
    minifyCssIdents.apply();
    expect(minifyCssIdents.getContextPath()).toBe('some-context');
  });

  it('Invalid options are rejected', () => {
    expect(() => new MinifyCssIdents({ exclude: ['*'] })).toThrow(
      'Invalid "exclude" option\n  The * wildchar can only be used at the end of an identifier',
    );
  });

  it('Idents are incremented from "a" to "z"', () => {
    const minifyCssIdents = new MinifyCssIdents();
    for (const char of MinifyCssIdents.alphabet) {
      if (isNaN(Number(char))) {
        minifyCssIdents.expectIdent(char);
      }
    }
  });

  it('Idents are incremented from "z" to "az"', () => {
    const minifyCssIdents = new MinifyCssIdents({ exclude: [], startIdent: 'z' });
    for (const char of MinifyCssIdents.alphabet) {
      minifyCssIdents.expectIdent(`a${char}`);
    }
  });

  it('Idents are incremented from "az" to "b0"', () => {
    new MinifyCssIdents({ startIdent: 'az' }).expectIdent(`b0`);
  });

  it('Idents are incremented from "aNz" to "a(N + 1)z" or "b00"', () => {
    const minifyCssIdents = new MinifyCssIdents({ exclude: [] });
    const { alphabet } = MinifyCssIdents;
    for (const char of alphabet) {
      if (isNaN(Number(char))) {
        const expectedChar = alphabet[alphabet.indexOf(char) + 1];
        const expectedIdent = expectedChar ? `a${expectedChar}0` : 'b00';
        minifyCssIdents.setLastIdent(`a${char}z`).expectIdent(expectedIdent);
      }
    }
  });

  it('Idents are stored in and fetched from map', () => {
    const minifyCssIdents = new MinifyCssIdents();
    minifyCssIdents.expectIdent('a');
    minifyCssIdents.expectIdent('b');
    minifyCssIdents.expectIdent('a');
  });

  it('Idents/prefixes are excluded', () => {
    const minifyCssIdents = new MinifyCssIdents({ exclude: ['a', 'ad*'] });
    expect(minifyCssIdents.options).toMatchObject({ exclude: ['a'], excludePrefix: ['ad'] });
    minifyCssIdents.expectIdent('b');
    minifyCssIdents.setLastIdent('ac').expectIdent('ae');
    minifyCssIdents.setLastIdent('acz').expectIdent('ae0');
    minifyCssIdents.setLastIdent('aczz').expectIdent('ae00');
  });

  it('Idents are made from context', () => {
    const minifyCssIdents = new MinifyCssIdents();
    minifyCssIdents.getLocalIdent({ resourcePath: 'some-path' }, 'n/a', 'some-name');
    expect(minifyCssIdents.getIdentMap()).toMatchObject({ 'some-path/some-name': 'a' });
  });

  it('Hooks are attached to compiler', () => {
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    expect(compiler.hooks.beforeCompile.listenerCount('emit')).toBe(1);
    expect(compiler.hooks.afterEmit.listenerCount('emit')).toBe(1);
  });

  it('Ident map is loaded', () => {
    const identMap = { someIdent: 'a', otherIdent: 'bb', lastIdent: 'cc', postIdent: 'aa' };
    mockedFs.readFileSync.mockImplementation(() => JSON.stringify(identMap));
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    minifyCssIdents.apply().hooks.beforeCompile.emit();
    expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.readFileSync).toHaveBeenCalledWith('some-file', 'utf-8');
    expect(minifyCssIdents.getIdentMap()).toStrictEqual(identMap);
    expect(minifyCssIdents.getLastIdent()).toStrictEqual(['c', 'c']);
  });

  it('A non-existing ident map is ignored', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).not.toThrow();
  });

  it('A non-readable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow('Failure to read some-file\n  Error');
  });

  it('A non-parsable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => 'non-json');
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow(
      'Failure to parse some-file\n  SyntaxError: Unexpected token \'o\', "non-json" is not valid JSON',
    );
  });

  it('An invalid ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => 'null');
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow('Invalid CSS identifier map in some-file\n  Expected string dictionary, got null');
  });

  it('A map with invalid idents is rejected', () => {
    const longString = '................................................................................';
    const strIndentMap = JSON.stringify({ 'a': null, 'b': [], 'c': 0, 'd': '0', 'e!': longString });
    mockedFs.readFileSync.mockImplementation(() => strIndentMap);
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    const details = '\n  a: null\n  b: array\n  c: number\n  d: "0"\n  "e!": string(80)';
    expect(beforeCompile).toThrow(`Invalid CSS identifier(s) in some-file${details}`);
  });

  it('The ident map is saved', () => {
    mockedFs.mkdirSync.mockImplementation();
    mockedFs.writeFileSync.mockImplementation();
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file', mapIndent: 0 });
    minifyCssIdents.generateIdent('alpha');
    minifyCssIdents.generateIdent('beta');
    minifyCssIdents.generateIdent('alpha');
    minifyCssIdents.apply().hooks.afterEmit.emit();
    expect(mockedFs.mkdirSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('.', { recursive: true });
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith('some-file', '{"alpha":"a","beta":"b"}\n', 'utf-8');
  });

  it('Error is throw and warning is issued for ident map saving failure', () => {
    consoleWarnSpy.mockImplementation();
    mockedFs.mkdirSync.mockImplementation(() => {
      throw new Error();
    });
    mockedFs.writeFileSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file' });
    const afterEmit = minifyCssIdents.apply().hooks.afterEmit.listener;
    expect(afterEmit).toThrow('Failure to write CSS identifier map some-file\n  Error');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failure to create directory .\n  Error');
  });

  it('The ident map is removed', () => {
    mockedFs.rmSync.mockImplementation();
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.afterEmit.emit();
    expect(mockedFs.rmSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.rmSync).toHaveBeenCalledWith('some-file');
  });

  it('Warning is issued for ident map removal failure', () => {
    consoleWarnSpy.mockImplementation();
    mockedFs.rmSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdents({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.afterEmit.emit();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failure to remove CSS identifier map file some-file\n  Error');
  });
});
