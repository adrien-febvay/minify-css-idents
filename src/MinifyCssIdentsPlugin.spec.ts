import originalFs from 'fs';
import { join, sep } from 'path';
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

const someFile = join(sep, 'some-file');

let consoleWarnSpy: jest.SpyInstance<void, Parameters<Console['warn']>, unknown>;

beforeAll(() => {
  consoleWarnSpy = jest.spyOn(console, 'warn');
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('Check MinifyCssIdentsPlugin class', () => {
  it('Instance is registered and defaulted', () => {
    const fn = () => MinifyCssIdentsPlugin.getLocalIdent('some-path', 'n/a', 'some-name');
    expect(fn).not.toThrow();
    expect(MinifyCssIdentsPlugin.implicitInstance).not.toBe(void 0);
    expect(fn).not.toThrow();
  });

  it('Instance is registered in loader context', () => {
    const minifyCssIdentsPlugin = new MinifyCssIdentsPlugin();
    const { compilation } = minifyCssIdentsPlugin.apply().hooks;
    compilation.trigger();
    expect(compilation.loaderContext[MinifyCssIdentsPlugin.symbol]).toBe(minifyCssIdentsPlugin);
  });

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
    expect(minifyCssIdents.identGenerator.identMap).toStrictEqual({});
    expect(compiler.hooks.beforeCompile.listeners.length).toBe(0);
    expect(compiler.hooks.compilation.hooks.afterProcessAssets.listeners.length).toBe(0);
  });

  it('Filename is resolved', () => {
    fs.readFileSync.mockImplementation(() => '{}');
    const minifyCssIdents1 = new MinifyCssIdentsPlugin({ filename: 'some-file' });
    minifyCssIdents1.apply().hooks.beforeCompile.trigger();
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync).toHaveBeenCalledWith(join(sep, 'default-context', 'some-file'), 'utf-8');
    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ filename: someFile });
    minifyCssIdents2.apply().hooks.beforeCompile.trigger();
    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync).toHaveBeenCalledWith(someFile, 'utf-8');
  });

  it('Idents are made from context', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin();
    minifyCssIdents1.getLocalIdent('some-path', 'n/a', 'some-name');
    expect(minifyCssIdents1.identGenerator.identMap).toStrictEqual({ '___some-path__some-name': 'a' });
    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ enabled: false });
    expect(minifyCssIdents2.getLocalIdent('some-path', 'n/a', 'some-name')).toBe('___some-path__some-name');
  });

  it('Ident map is loaded', () => {
    fs.readFileSync.mockImplementation(() => '{}');
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: someFile });
    minifyCssIdents.apply().hooks.beforeCompile.trigger();
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync).toHaveBeenCalledWith(someFile, 'utf-8');
  });

  it('The ident map is saved', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: someFile, mapIndent: 0 });
    const { compilation } = minifyCssIdents.apply().hooks;
    compilation.emitAsset.mockImplementation();
    compilation.trigger();
    expect(compilation.emitAsset).toHaveBeenCalledTimes(1);
    expect(compilation.emitAsset).toHaveBeenCalledWith(join('..', someFile), new sources.RawSource('{}\n'));
  });

  it('The ident map is removed', () => {
    fs.rmSync.mockImplementation();
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: someFile, mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.trigger();
    expect(fs.rmSync).toHaveBeenCalledTimes(1);
    expect(fs.rmSync).toHaveBeenCalledWith(someFile);
  });

  it('Warning is issued for ident map removal failure', () => {
    consoleWarnSpy.mockImplementation();
    fs.rmSync.mockImplementation(() => {
      throw new Error();
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin({ filename: someFile, mode: 'consume-map' });
    minifyCssIdents.apply().hooks.compilation.trigger();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(`Failure to remove CSS identifier map file ${someFile}\n  Error`);
  });

  it('Static method "getLocalIdent" uses the correct instance', () => {
    // Auto-instanciation
    MinifyCssIdentsPlugin.implicitInstance = void 0;
    const getLocalIdent = MinifyCssIdentsPlugin.getLocalIdent;
    expect(getLocalIdent).not.toThrow();
    const minifyCssIdentsPlugin1 = MinifyCssIdentsPlugin.implicitInstance;
    expect(minifyCssIdentsPlugin1).not.toBe(void 0);

    // Use cached instance
    expect(getLocalIdent).not.toThrow();
    expect(MinifyCssIdentsPlugin.implicitInstance).toBe(minifyCssIdentsPlugin1);

    // Use implicit instance
    expect(MinifyCssIdentsPlugin.getLocalIdent).not.toThrow();
    expect(MinifyCssIdentsPlugin.implicitInstance).toBe(minifyCssIdentsPlugin1);

    // Use instance in loader context
    // We want to make sure getLocalIdent is called on the right instance, without the help of implicitInstance
    const minifyCssIdentsPlugin2 = new MinifyCssIdentsPlugin();
    MinifyCssIdentsPlugin.implicitInstance = void 0;
    const { compilation } = minifyCssIdentsPlugin2.apply().hooks;
    compilation.trigger();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const get = jest.fn(Object.getOwnPropertyDescriptor(MinifyCssIdentsPlugin.prototype, 'getLocalIdent')?.get);
    Object.defineProperty(minifyCssIdentsPlugin2, 'getLocalIdent', { get });
    expect(() => MinifyCssIdentsPlugin.getLocalIdent(compilation.loaderContext)).not.toThrow();
    expect(get).toHaveBeenCalledTimes(1);
  });

  function itExpectsMode(
    mode: MinifyCssIdentsPlugin['options']['mode'],
    ...expectations: ('toIgnoreENoEnt' | 'toLoad' | 'toEmit' | 'toRemove')[]
  ) {
    it(`Mode "${mode}" works as intended`, () => {
      fs.readFileSync.mockImplementation(() => {
        if (expectations.includes('toIgnoreENoEnt')) {
          throw Object.assign(new Error(), { code: 'ENOENT' });
        }
        return '{}';
      });
      fs.readFileSync.mockName('fs.readFileSync');
      fs.rmSync.mockImplementation();
      fs.readFileSync.mockName('fs.rmSync');
      const minifyCssIdents = new MinifyCssIdentsPlugin({ mode, filename: someFile });
      const { beforeCompile, compilation } = minifyCssIdents.apply().hooks;
      compilation.emitAsset.mockImplementation();
      compilation.emitAsset.mockName('compilation.emitAsset');
      beforeCompile.trigger();
      compilation.trigger();
      try {
        expect(fs.readFileSync).toHaveBeenCalledTimes(Number(expectations.includes('toLoad')));
        expect(compilation.emitAsset).toHaveBeenCalledTimes(Number(expectations.includes('toEmit')));
        expect(fs.rmSync).toHaveBeenCalledTimes(Number(expectations.includes('toRemove')));
      } catch (error) {
        if (error instanceof Error) {
          Error.captureStackTrace(error, itExpectsMode);
        }
        throw error;
      }
    });
  }

  itExpectsMode('default', 'toIgnoreENoEnt', 'toLoad', 'toEmit');
  itExpectsMode('load-map', 'toLoad');
  itExpectsMode('extend-map', 'toLoad', 'toEmit');
  itExpectsMode('consume-map', 'toLoad', 'toRemove');
  itExpectsMode('create-map', 'toEmit');
});
