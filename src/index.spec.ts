import { Compiler, sources } from 'webpack';
import { join } from 'path';
import fs from 'fs';
import EventEmitter from 'events';
import OriginalMinifiyCssIdentsPlugin from '.';

class MinifiyCssIdentsPlugin extends OriginalMinifiyCssIdentsPlugin {
  public apply() {
    const compiler = mockCompiler();
    super.apply(compiler);
    return compiler;
  }

  public expectIdent(ident: string, key = `test-${ident}`) {
    try {
      expect(this.identManager.generateIdent(key)).toBe(ident);
    } catch (error) {
      if (error instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        Error.captureStackTrace(error, MinifiyCssIdentsPlugin.prototype.expectIdent);
      }
      throw error;
    }
  }

  public getContextPath() {
    return this.contextPath;
  }

  public getIdentManager() {
    return this.identManager;
  }

  public getIdentMap() {
    return this.identManager.identMap;
  }

  public getLastIdent() {
    return this.identManager.lastIdent;
  }

  public setLastIdent(lastIndent: string): this {
    this.identManager.lastIdent = lastIndent.split('');
    return this;
  }
}

function mockCompiler() {
  const beforeCompile = new FakeHook();
  const compilation = new CompilationHook();
  const fakeCompiler = { context: '/default-context', hooks: { beforeCompile, compilation } };
  return fakeCompiler as Compiler & typeof fakeCompiler;
}

class FakeHook<TapType = string> extends EventEmitter {
  public emit() {
    return super.emit('emit');
  }

  public get listener() {
    return this.listeners('emit')[0];
  }

  public listenerCount() {
    return super.listenerCount('emit');
  }

  public tap(_type: TapType, callback: (hook: this) => void) {
    this.on('emit', () => callback.call(null, this));
  }
}

class CompilationHook extends FakeHook<string> {
  public readonly hooks = { afterProcessAssets: new FakeHook<{ stage: number; name: string }>() };

  public emitAsset = jest.fn();

  public emit() {
    super.emit();
    return this.hooks.afterProcessAssets.emit();
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

describe('Check MinifiyCssIdentsPlugin plugin and loader', () => {
  it('Options are defaulted', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin();
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
    expect(minifyCssIdents.getContextPath()).toBe('/default-context');
  });

  it('Options are resolved', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin(someOptions);
    expect(minifyCssIdents.options).toMatchObject({
      ...someOptions,
      exclude: ['some-ident'],
      excludePrefix: ['some-ident-prefix-'],
    });
    minifyCssIdents.apply();
    expect(minifyCssIdents.getContextPath()).toBe('some-context');
  });

  it('Invalid options are rejected', () => {
    expect(() => new MinifiyCssIdentsPlugin({ exclude: ['*'] })).toThrow(
      'Invalid "exclude" option\n  The * wildchar can only be used at the end of an identifier',
    );
  });

  it('Idents are incremented from "a" to "z"', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin();
    for (const char of MinifiyCssIdentsPlugin.alphabet) {
      if (isNaN(Number(char))) {
        minifyCssIdents.expectIdent(char);
      }
    }
  });

  it('Idents are incremented from "z" to "az"', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ exclude: [], startIdent: 'z' });
    for (const char of MinifiyCssIdentsPlugin.alphabet) {
      minifyCssIdents.expectIdent(`a${char}`);
    }
  });

  it('Idents are incremented from "az" to "b0"', () => {
    new MinifiyCssIdentsPlugin({ startIdent: 'az' }).expectIdent(`b0`);
  });

  it('Idents are incremented from "aNz" to "a(N + 1)z" or "b00"', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ exclude: [] });
    const { alphabet } = MinifiyCssIdentsPlugin;
    for (const char of alphabet) {
      if (isNaN(Number(char))) {
        const expectedChar = alphabet[alphabet.indexOf(char) + 1];
        const expectedIdent = expectedChar ? `a${expectedChar}0` : 'b00';
        minifyCssIdents.setLastIdent(`a${char}z`).expectIdent(expectedIdent);
      }
    }
  });

  it('Idents are stored in and fetched from map', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin();
    minifyCssIdents.expectIdent('a');
    minifyCssIdents.expectIdent('b');
    minifyCssIdents.expectIdent('a');
  });

  it('Idents/prefixes are excluded', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ exclude: ['a', 'ad*'] });
    expect(minifyCssIdents.options).toMatchObject({ exclude: ['a'], excludePrefix: ['ad'] });
    minifyCssIdents.expectIdent('b');
    minifyCssIdents.setLastIdent('ac').expectIdent('ae');
    minifyCssIdents.setLastIdent('acz').expectIdent('ae0');
    minifyCssIdents.setLastIdent('aczz').expectIdent('ae00');
  });

  it('Idents are made from context', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin();
    minifyCssIdents.getLocalIdent({ resourcePath: 'some-path' }, 'n/a', 'some-name');
    expect(minifyCssIdents.getIdentMap()).toMatchObject({ 'some-path/some-name': 'a' });
  });

  it('Hooks are attached to compiler', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const { hooks } = minifyCssIdents.apply();
    hooks.compilation.emit();
    expect(hooks.beforeCompile.listenerCount()).toBe(1);
    expect(hooks.compilation.listenerCount()).toBe(1);
    expect(hooks.compilation.hooks.afterProcessAssets.listenerCount()).toBe(1);
  });

  it('Ident map is loaded', () => {
    const identMap = { someIdent: 'a', otherIdent: 'bb', lastIdent: 'cc', postIdent: 'aa' };
    mockedFs.readFileSync.mockImplementation(() => JSON.stringify(identMap));
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
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
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).not.toThrow();
  });

  it('A non-readable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow('Failure to read some-file\n  Error');
  });

  it('A non-parsable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => 'non-json');
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow(
      'Failure to parse some-file\n  SyntaxError: Unexpected token \'o\', "non-json" is not valid JSON',
    );
  });

  it('An invalid ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => 'null');
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow('Invalid CSS identifier map in some-file\n  Expected string dictionary, got null');
  });

  it('A map with invalid idents is rejected', () => {
    const longString = '................................................................................';
    const strIndentMap = JSON.stringify({ 'a': null, 'b': [], 'c': 0, 'd': '0', 'e!': longString });
    mockedFs.readFileSync.mockImplementation(() => strIndentMap);
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    const details = '\n  a: null\n  b: array\n  c: number\n  d: "0"\n  "e!": string(80)';
    expect(beforeCompile).toThrow(`Invalid CSS identifier(s) in some-file${details}`);
  });

  it('The ident map is saved', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file', mapIndent: 0 });
    const identManager = minifyCssIdents.getIdentManager();
    identManager.generateIdent('alpha');
    identManager.generateIdent('beta');
    identManager.generateIdent('alpha');
    const { compilation } = minifyCssIdents.apply().hooks;
    compilation.emitAsset.mockImplementation();
    compilation.emit();
    expect(compilation.emitAsset).toHaveBeenCalledTimes(1);
    expect(compilation.emitAsset).toHaveBeenCalledWith(
      'some-file',
      new sources.RawSource('{"alpha":"a","beta":"b"}\n'),
    );
  });

  it('The ident map is saved using an absolute path', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: '/some-file' });
    const { compilation } = minifyCssIdents.apply().hooks;
    compilation.emitAsset.mockImplementation();
    compilation.emit();
    expect(compilation.emitAsset).toHaveBeenCalledWith(join('..', 'some-file'), new sources.RawSource('{}\n'));
  });

  it('The ident map is removed', () => {
    mockedFs.rmSync.mockImplementation();
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.emit();
    expect(mockedFs.rmSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.rmSync).toHaveBeenCalledWith('some-file');
  });

  it('Warning is issued for ident map removal failure', () => {
    consoleWarnSpy.mockImplementation();
    mockedFs.rmSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.emit();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failure to remove CSS identifier map file some-file\n  Error');
  });
});
