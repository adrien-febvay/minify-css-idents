import { Compiler, sources } from 'webpack';
import { join } from 'path';
import fs from 'fs';
import EventEmitter from 'events';
import OriginalMinifyCssIdentsPlugin from '.';

class MinifyCssIdentsPlugin extends OriginalMinifyCssIdentsPlugin {
  public apply() {
    const compiler = mockCompiler();
    super.apply(compiler);
    return compiler;
  }

  public getContextPath() {
    return this.contextPath;
  }

  public getIdentManager() {
    return this.identManager;
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
  filename: 'some-filename',
  mapIndent: 4,
  mode: 'extend-map',
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

describe('Check MinifyCssIdentsPlugin plugin and loader', () => {
  it('Options are defaulted', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin();
    expect(minifyCssIdents.options).toMatchObject({
      context: null,
      filename: null,
      mapIndent: 2,
      mode: 'default',
    });
    minifyCssIdents.apply();
    expect(minifyCssIdents.getContextPath()).toBe('/default-context');
  });

  it('Options are resolved', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin(someOptions);
    expect(minifyCssIdents.options).toMatchObject(someOptions);
    minifyCssIdents.apply();
    expect(minifyCssIdents.getContextPath()).toBe('some-context');
  });

  it('Idents are made from context', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin();
    minifyCssIdents.getLocalIdent({ resourcePath: 'some-path' }, 'n/a', 'some-name');
    expect(minifyCssIdents.getIdentManager().identMap).toMatchObject({ 'some-path/some-name': 'a' });
  });

  it('Ident map is loaded', () => {
    mockedFs.readFileSync.mockImplementation(() => '{"a":"b"}');
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    minifyCssIdents.apply().hooks.beforeCompile.emit();
    expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.readFileSync).toHaveBeenCalledWith('some-file', 'utf-8');
    expect(minifyCssIdents.getIdentManager().identMap).toStrictEqual({ a: 'b' });
  });

  it('A non-existing ident map is ignored', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).not.toThrow();
  });

  it('A non-readable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow('Failure to read some-file\n  Error');
  });

  it('A non-parsable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => 'non-json');
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow(
      'Failure to parse some-file\n  SyntaxError: Unexpected token \'o\', "non-json" is not valid JSON',
    );
  });

  it('The ident map is saved', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file', mapIndent: 0 });
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
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: '/some-file' });
    const { compilation } = minifyCssIdents.apply().hooks;
    compilation.emitAsset.mockImplementation();
    compilation.emit();
    expect(compilation.emitAsset).toHaveBeenCalledWith(join('..', 'some-file'), new sources.RawSource('{}\n'));
  });

  it('The ident map is removed', () => {
    mockedFs.rmSync.mockImplementation();
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.emit();
    expect(mockedFs.rmSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.rmSync).toHaveBeenCalledWith('some-file');
  });

  it('Warning is issued for ident map removal failure', () => {
    consoleWarnSpy.mockImplementation();
    mockedFs.rmSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.emit();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failure to remove CSS identifier map file some-file\n  Error');
  });
});
