import { Compiler, LoaderContext, WebpackOptionsNormalized, sources } from 'webpack';
import { join } from 'path';
import fs from 'fs';
import EventEmitter from 'events';
import OriginalMinifiyCssIdentsPlugin from '.';

class MinifiyCssIdentsPlugin extends OriginalMinifiyCssIdentsPlugin {
  public mockedApply(webpackOptions?: Partial<WebpackOptionsNormalized>) {
    const compiler = mockCompiler(webpackOptions);
    super.apply(compiler);
    return compiler;
  }

  public mockedGetLocalIdent(resourcePath: string, localIdentName: string, localName: string) {
    return this.getLocalIdent({ resourcePath } as LoaderContext<object>, localIdentName, localName, {});
  }

  public getEnabled() {
    return this.enabled;
  }

  public getIdentManager() {
    return this.identManager;
  }
}

function mockCompiler(webpackOptions: Partial<WebpackOptionsNormalized> = {}) {
  const beforeCompile = new FakeHook();
  const compilation = new CompilationHook();
  const options = { ...webpackOptions, mode: webpackOptions.mode ?? 'production' };
  const fakeCompiler = { context: '/default-context', hooks: { beforeCompile, compilation }, options };
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
  enabled: true,
  filename: 'some-filename',
  mapIndent: 4,
  mode: 'extend-map',
} as const;

jest.mock('css-loader');

jest.mock('fs');
const mockedFs = jest.requireMock<{ [Key in keyof typeof fs]: jest.Mock }>('fs');

let consoleWarnSpy: jest.SpyInstance<void, Parameters<Console['warn']>, unknown>;

beforeAll(() => {
  consoleWarnSpy = jest.spyOn(console, 'warn');
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Check MinifiyCssIdentsPlugin plugin', () => {
  it('Options are defaulted', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin();
    expect(minifyCssIdents.options).toMatchObject({
      enabled: null,
      filename: null,
      mapIndent: 2,
      mode: 'default',
    });
  });

  it('Options are resolved', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin(someOptions);
    expect(minifyCssIdents.options).toMatchObject(someOptions);
  });

  it('Plug-in "enabled" state is resolved', () => {
    const minifyCssIdents1 = new MinifiyCssIdentsPlugin(someOptions);
    minifyCssIdents1.mockedApply();
    expect(minifyCssIdents1.getEnabled()).toBe(someOptions.enabled);
    const minifyCssIdents2 = new MinifiyCssIdentsPlugin();
    minifyCssIdents2.mockedApply();
    expect(minifyCssIdents2.getEnabled()).toBe(true);
    const minifyCssIdents3 = new MinifiyCssIdentsPlugin();
    minifyCssIdents3.mockedApply({ mode: 'development' });
    expect(minifyCssIdents3.getEnabled()).toBe(false);
  });

  it('Plug-in "enabled" state is effective', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ enabled: false });
    const compiler = minifyCssIdents.mockedApply();
    minifyCssIdents.mockedGetLocalIdent('some-path', 'n/a', 'some-name');
    expect(minifyCssIdents.getIdentManager().identMap).toStrictEqual({});
    expect(compiler.hooks.beforeCompile.listenerCount()).toBe(0);
    expect(compiler.hooks.compilation.listenerCount()).toBe(0);
    expect(compiler.hooks.compilation.hooks.afterProcessAssets.listenerCount()).toBe(0);
  });

  it('Idents are made from context', () => {
    const minifyCssIdents1 = new MinifiyCssIdentsPlugin();
    minifyCssIdents1.mockedGetLocalIdent('some-path', 'n/a', 'some-name');
    expect(minifyCssIdents1.getIdentManager().identMap).toStrictEqual({ '___some-path__some-name': 'a' });
    const minifyCssIdents2 = new MinifiyCssIdentsPlugin({ enabled: false });
    expect(minifyCssIdents2.mockedGetLocalIdent('some-path', 'n/a', 'some-name')).toBe('___some-path__some-name');
  });

  it('Ident map is loaded', () => {
    mockedFs.readFileSync.mockImplementation(() => '{"a":"b"}');
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    minifyCssIdents.mockedApply().hooks.beforeCompile.emit();
    expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.readFileSync).toHaveBeenCalledWith('some-file', 'utf-8');
    expect(minifyCssIdents.getIdentManager().identMap).toStrictEqual({ a: 'b' });
  });

  it('A non-existing ident map is ignored', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.mockedApply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).not.toThrow();
  });

  it('A non-readable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.mockedApply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow('Failure to read some-file\n  Error');
  });

  it('A non-parsable ident map is rejected', () => {
    mockedFs.readFileSync.mockImplementation(() => 'non-json');
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.mockedApply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow(
      'Failure to parse some-file\n  SyntaxError: Unexpected token \'o\', "non-json" is not valid JSON',
    );
  });

  it('The ident map is saved', () => {
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file', mapIndent: 0 });
    const identManager = minifyCssIdents.getIdentManager();
    identManager.generateIdent('alpha');
    identManager.generateIdent('beta');
    identManager.generateIdent('alpha');
    const { compilation } = minifyCssIdents.mockedApply().hooks;
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
    const { compilation } = minifyCssIdents.mockedApply().hooks;
    compilation.emitAsset.mockImplementation();
    compilation.emit();
    expect(compilation.emitAsset).toHaveBeenCalledWith(join('..', 'some-file'), new sources.RawSource('{}\n'));
  });

  it('The ident map is removed', () => {
    mockedFs.rmSync.mockImplementation();
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.mockedApply().hooks.compilation.emit();
    expect(mockedFs.rmSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.rmSync).toHaveBeenCalledWith('some-file');
  });

  it('Warning is issued for ident map removal failure', () => {
    consoleWarnSpy.mockImplementation();
    mockedFs.rmSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifiyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.mockedApply().hooks.compilation.emit();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failure to remove CSS identifier map file some-file\n  Error');
  });
});
