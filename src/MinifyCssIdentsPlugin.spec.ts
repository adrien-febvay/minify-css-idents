import type originalFs from 'fs';
import type cssLoaderMock from './__mocks__/css-loader';
import { join, sep } from 'path';
import { LoaderContext, sources } from 'webpack';
import { MinifyCssIdentsPlugin } from './__mocks__/MinifyCssIdentsPlugin';

jest.mock('css-loader');
const cssLoader = jest.requireMock<typeof cssLoaderMock>('css-loader');

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
    const minifyCssIdents3 = new MinifyCssIdentsPlugin(null, { optimization: { minimize: false } });
    minifyCssIdents3.apply();
    expect(minifyCssIdents3.enabled).toBe(false);
    const minifyCssIdents4 = new MinifyCssIdentsPlugin(null, { mode: 'development', optimization: {} });
    minifyCssIdents4.apply();
    expect(minifyCssIdents4.enabled).toBe(false);
    const minifyCssIdents5 = new MinifyCssIdentsPlugin();
    const context5 = { _compiler: { options: { optimization: { minimize: true } } } } as LoaderContext<object>;
    expect(minifyCssIdents5.getLocalIdent(() => 'unminified')(context5)).toBe('a');
    const minifyCssIdents6 = new MinifyCssIdentsPlugin();
    const context6 = { _compiler: { options: { optimization: { minimize: false } } } } as LoaderContext<object>;
    expect(minifyCssIdents6.getLocalIdent(() => 'unminified')(context6)).toBe('unminified');
    const minifyCssIdents7 = new MinifyCssIdentsPlugin();
    const context7 = { mode: 'production' } as LoaderContext<object>;
    expect(minifyCssIdents7.getLocalIdent(() => 'unminified')(context7)).toBe('a');
    const minifyCssIdents8 = new MinifyCssIdentsPlugin();
    const context8 = { mode: 'development' } as LoaderContext<object>;
    expect(minifyCssIdents8.getLocalIdent(() => 'unminified')(context8)).toBe('unminified');
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

  it('Idents are made from default idents', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin();
    minifyCssIdents1.getLocalIdent('some-path', 'n/a', 'some-name');
    expect(minifyCssIdents1.identGenerator.identMap).toStrictEqual({ '___some-path__some-name': 'a' });
    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ enabled: false });
    expect(minifyCssIdents2.getLocalIdent('some-path', 'n/a', 'some-name')).toBe('___some-path__some-name');
  });

  it('Idents are made from custom idents', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin();
    minifyCssIdents1.getLocalIdent(() => 'custom-ident-1')('');
    MinifyCssIdentsPlugin.getLocalIdent(() => 'custom-ident-2')('');
    expect(minifyCssIdents1.identGenerator.identMap).toStrictEqual({ 'custom-ident-1': 'a', 'custom-ident-2': 'b' });
  });

  it('The `css-loader` is wrapped correctly', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin();

    const cssLoader1 = minifyCssIdents.cssLoader;
    const options1 = {};
    const context1 = { getOptions: () => options1, resourcePath: 'some-path' } as LoaderContext<object>;
    void cssLoader1.pitch?.call(context1, '', '', {});
    expect(cssLoader1.call(context1, 'ident-1 ident-2 ident-1')).toBe('a b a');
    expect(minifyCssIdents.identGenerator.identMap).toStrictEqual({
      '___some-path__ident-1': 'a',
      '___some-path__ident-2': 'b',
    });

    const cssLoader2 = MinifyCssIdentsPlugin.cssLoader;
    const options2 = {};
    const context2 = { getOptions: () => options2, resourcePath: 'other-path' } as LoaderContext<object>;
    void cssLoader2.pitch?.call(context2, '', '', {});
    expect(cssLoader2.call(context2, 'ident-1 ident-2 ident-1')).toBe('c d c');
    expect(minifyCssIdents.identGenerator.identMap).toStrictEqual({
      '___some-path__ident-1': 'a',
      '___some-path__ident-2': 'b',
      '___other-path__ident-1': 'c',
      '___other-path__ident-2': 'd',
    });
  });

  it('The `css-loader` pitch is called if it exists', () => {
    cssLoader.pitch = () => 'defined';
    const context = { getOptions: () => ({}) } as LoaderContext<object>;
    expect(MinifyCssIdentsPlugin.cssLoader.pitch?.call(context, '', '', {})).toBe('defined');
  });

  it('The getOptions() method is overriden once and only once', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin();
    const cssLoader = minifyCssIdents.cssLoader;
    const context = { getOptions(this: void) {} };
    const getOptions0 = context.getOptions;
    void cssLoader.pitch?.call(context as LoaderContext<object>, '', '', {});
    const getOptions1 = context.getOptions;
    expect(getOptions1 === getOptions0).toBe(false);
    void cssLoader.pitch?.call(context as LoaderContext<object>, '', '', {});
    const getOptions2 = context.getOptions;
    expect(getOptions2 === getOptions1).toBe(true);
  });

  it('The getLocalIdent option is voided when not a function', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin({ enabled: false });
    const cssLoader1 = minifyCssIdents1.cssLoader;
    const options1 = { modules: { getLocalIdent: () => 'custom-ident' } };
    const context1 = { getOptions: () => options1, resourcePath: 'some-path' } as LoaderContext<object>;
    void cssLoader1.pitch?.call(context1, '', '', {});
    expect(cssLoader1.call(context1, 'ident-1')).toBe('custom-ident');

    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ enabled: false });
    const cssLoader2 = minifyCssIdents2.cssLoader;
    const options2 = { modules: { getLocalIdent: 'bad-value' } };
    const context2 = { getOptions: () => options2, resourcePath: 'some-path' } as LoaderContext<object>;
    void cssLoader2.pitch?.call(context2, '', '', {});
    expect(cssLoader2.call(context2, 'ident-1')).toBe('___some-path__ident-1');
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
    expect(() => getLocalIdent('')).not.toThrow();
    const minifyCssIdentsPlugin1 = MinifyCssIdentsPlugin.implicitInstance;
    expect(minifyCssIdentsPlugin1).not.toBe(void 0);

    // Cached instance
    expect(() => getLocalIdent('')).not.toThrow();
    expect(MinifyCssIdentsPlugin.implicitInstance).toBe(minifyCssIdentsPlugin1);

    // Use implicit instance
    expect(() => MinifyCssIdentsPlugin.getLocalIdent('')).not.toThrow();
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
    const loaderContext = { ...compilation.loaderContext, resourcePath: '' };
    expect(() => MinifyCssIdentsPlugin.getLocalIdent(loaderContext)).not.toThrow();
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
