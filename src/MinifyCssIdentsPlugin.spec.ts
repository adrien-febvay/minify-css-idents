import originalFs from 'fs';
import { join } from 'path';
import { sources } from 'webpack';
import { MinifyCssIdentsPlugin } from './__mocks__/MinifyCssIdentsPlugin';

jest.mock('css-loader');
jest.mock('fs');
const fs = jest.requireMock<{ [Key in keyof typeof originalFs]: jest.Mock }>('fs');

const someOptions = {
  enabled: true,
  filename: 'some-filename',
  mapIndent: 4,
  mode: 'extend-map',
} as const;

let consoleWarnSpy: jest.SpyInstance<void, Parameters<Console['warn']>, unknown>;

beforeAll(() => {
  consoleWarnSpy = jest.spyOn(console, 'warn');
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Check MinifyCssIdentsPlugin plugin', () => {
  it('Options are defaulted', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin();
    expect(minifyCssIdents.options).toMatchObject({
      enabled: null,
      filename: null,
      mapIndent: 2,
      mode: 'default',
    });
  });

  it('Options are resolved', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin(someOptions);
    expect(minifyCssIdents.options).toMatchObject(someOptions);
  });

  it('Plug-in "enabled" state is resolved', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin(someOptions);
    minifyCssIdents1.apply();
    expect(minifyCssIdents1.enabled).toBe(someOptions.enabled);
    const minifyCssIdents2 = new MinifyCssIdentsPlugin();
    minifyCssIdents2.apply();
    expect(minifyCssIdents2.enabled).toBe(true);
    const minifyCssIdents3 = new MinifyCssIdentsPlugin(null, { mode: 'development' });
    minifyCssIdents3.apply();
    expect(minifyCssIdents3.enabled).toBe(false);
  });

  it('Plug-in "enabled" state is effective', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin({ enabled: false });
    const compiler = minifyCssIdents.apply();
    minifyCssIdents.getLocalIdent('some-path', 'n/a', 'some-name');
    expect(minifyCssIdents.identManager.identMap).toStrictEqual({});
    expect(compiler.hooks.beforeCompile.listenerCount()).toBe(0);
    expect(compiler.hooks.compilation.listenerCount()).toBe(0);
    expect(compiler.hooks.compilation.hooks.afterProcessAssets.listenerCount()).toBe(0);
  });

  it('Idents are made from context', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin();
    minifyCssIdents1.getLocalIdent('some-path', 'n/a', 'some-name');
    expect(minifyCssIdents1.identManager.identMap).toStrictEqual({ '___some-path__some-name': 'a' });
    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ enabled: false });
    expect(minifyCssIdents2.getLocalIdent('some-path', 'n/a', 'some-name')).toBe('___some-path__some-name');
  });

  it('Ident map is loaded', () => {
    fs.readFileSync.mockImplementation(() => '{"a":"b"}');
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    minifyCssIdents.apply().hooks.beforeCompile.emit();
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync).toHaveBeenCalledWith('some-file', 'utf-8');
    expect(minifyCssIdents.identManager.identMap).toStrictEqual({ a: 'b' });
  });

  it('A non-existing ident map is ignored', () => {
    fs.readFileSync.mockImplementation(() => {
      throw Object.assign(new Error(), { code: 'ENOENT' });
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).not.toThrow();
  });

  it('A non-readable ident map is rejected', () => {
    fs.readFileSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow('Failure to read some-file\n  Error');
  });

  it('A non-parsable ident map is rejected', () => {
    fs.readFileSync.mockImplementation(() => 'non-json');
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    const compiler = minifyCssIdents.apply();
    const beforeCompile = compiler.hooks.beforeCompile.listener;
    expect(beforeCompile).toThrow(
      'Failure to parse some-file\n  SyntaxError: Unexpected token \'o\', "non-json" is not valid JSON',
    );
  });

  it('The ident map is saved', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file', mapIndent: 0 });
    const identManager = minifyCssIdents.identManager;
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
    fs.rmSync.mockImplementation();
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.emit();
    expect(fs.rmSync).toHaveBeenCalledTimes(1);
    expect(fs.rmSync).toHaveBeenCalledWith('some-file');
  });

  it('Warning is issued for ident map removal failure', () => {
    consoleWarnSpy.mockImplementation();
    fs.rmSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: 'some-file', mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.emit();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith('Failure to remove CSS identifier map file some-file\n  Error');
  });
});