import type originalFs from 'fs';
import type cssLoaderMock from './__mocks__/css-loader';
import { join, sep } from 'path';
import { sources } from 'webpack';
import { MinifyCssIdentsPlugin, LoaderContext } from './__mocks__/MinifyCssIdentsPlugin';

jest.mock('css-loader');
const cssLoader = jest.requireMock<typeof cssLoaderMock>('css-loader');

jest.mock('fs');
const fs = jest.requireMock<{ [Key in keyof typeof originalFs]: jest.Mock }>('fs');

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
    const { thisCompilation } = minifyCssIdentsPlugin.apply().hooks;
    thisCompilation.trigger();
    expect(thisCompilation.loaderContext[MinifyCssIdentsPlugin.symbol]).toBe(minifyCssIdentsPlugin);
  });

  it('Options are resolved', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin();
    expect(minifyCssIdents1.options).toMatchObject({ outputMap: null, enabled: null, mapIndent: 2, inputMap: null });

    const someOptions = { enabled: true, inputMap: 'some-path', mapIndent: 4, outputMap: 'other-path' };
    const minifyCssIdents2 = new MinifyCssIdentsPlugin(someOptions);
    expect(minifyCssIdents2.options).toMatchObject(someOptions);
  });

  it('Plug-in "enabled" state is resolved', () => {
    const minifyCssIdents1 = new MinifyCssIdentsPlugin({ enabled: true });
    minifyCssIdents1.apply();
    expect(minifyCssIdents1.enabled).toBe(true);
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
    const context5 = { _compiler: { options: { optimization: { minimize: true } } } } as LoaderContext;
    expect(minifyCssIdents5.getLocalIdent(() => 'unminified')(context5)).toBe('a');
    const minifyCssIdents6 = new MinifyCssIdentsPlugin();
    const context6 = { _compiler: { options: { optimization: { minimize: false } } } } as LoaderContext;
    expect(minifyCssIdents6.getLocalIdent(() => 'unminified')(context6)).toBe('unminified');
    const minifyCssIdents7 = new MinifyCssIdentsPlugin();
    const context7 = { mode: 'production' } as LoaderContext;
    expect(minifyCssIdents7.getLocalIdent(() => 'unminified')(context7)).toBe('a');
    const minifyCssIdents8 = new MinifyCssIdentsPlugin();
    const context8 = { mode: 'development' } as LoaderContext;
    expect(minifyCssIdents8.getLocalIdent(() => 'unminified')(context8)).toBe('unminified');
  });

  it('Plug-in "enabled" state is effective', () => {
    const minifyCssIdents = new MinifyCssIdentsPlugin({ enabled: false });
    const compiler = minifyCssIdents.apply();
    minifyCssIdents.getLocalIdent('some-path', 'n/a', 'some-name');
    expect(minifyCssIdents.identGenerator.identMap).toStrictEqual({});
    expect(compiler.hooks.beforeCompile.listeners.length).toBe(0);
    expect(compiler.hooks.thisCompilation.hooks.afterProcessAssets.listeners.length).toBe(0);
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

  it('The `css-loader` pitch is called if it exists', () => {
    cssLoader.pitch.mockImplementation(function (this: unknown) {
      return this;
    });
    const context = { getOptions: () => ({}) } as LoaderContext;
    const arg2 = { some: 'data' };
    expect(MinifyCssIdentsPlugin.cssLoader.pitch?.call(context, 'arg0', 'arg1', arg2)).toBe(context);
    expect(cssLoader.pitch).toHaveBeenCalledTimes(1);
    expect(cssLoader.pitch).toHaveBeenCalledWith('arg0', 'arg1', arg2);
  });

  it('The `css-loader` is wrapped correctly', () => {
    cssLoader.mockImplementation(cssLoader.__mock);
    const minifyCssIdents = new MinifyCssIdentsPlugin();

    const cssLoader1 = minifyCssIdents.cssLoader;
    const options1 = {};
    const context1 = { getOptions: () => options1, resourcePath: 'some-path' } as LoaderContext;
    expect(cssLoader1.call(context1, 'ident-1 ident-2 ident-1')).toBe('a b a');
    expect(minifyCssIdents.identGenerator.identMap).toStrictEqual({
      '___some-path__ident-1': 'a',
      '___some-path__ident-2': 'b',
    });

    const cssLoader2 = MinifyCssIdentsPlugin.cssLoader;
    const options2 = {};
    const context2 = { getOptions: () => options2, resourcePath: 'other-path' } as LoaderContext;
    expect(cssLoader2.call(context2, 'ident-1 ident-2 ident-1')).toBe('c d c');
    expect(minifyCssIdents.identGenerator.identMap).toStrictEqual({
      '___some-path__ident-1': 'a',
      '___some-path__ident-2': 'b',
      '___other-path__ident-1': 'c',
      '___other-path__ident-2': 'd',
    });
  });

  it('The loader options are overriden once and only once', () => {
    let lastOptions: NodeJS.Dict<unknown> = {};
    cssLoader.mockImplementation(function (this: LoaderContext) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastOptions = this.getOptions();
    });
    const minifyCssIdents = new MinifyCssIdentsPlugin();
    const wrappedCssLoader = minifyCssIdents.cssLoader;
    const context0 = { getOptions: () => ({}) } as LoaderContext;
    void wrappedCssLoader.call(context0, '');
    const options1 = lastOptions;
    expect(context0.getOptions()).toStrictEqual({});
    expect(options1.modules).not.toBe(void 0);
    void wrappedCssLoader.call(context0, '');
    const options2 = lastOptions;
    expect(options2).toStrictEqual(options1);
  });

  it('The getLocalIdent option is voided when not a function', () => {
    cssLoader.mockImplementation(cssLoader.__mock);

    const minifyCssIdents1 = new MinifyCssIdentsPlugin({ enabled: false });
    const cssLoader1 = minifyCssIdents1.cssLoader;
    const options1: NodeJS.Dict<unknown> = { modules: { getLocalIdent: () => 'custom-ident' } };
    const context1 = { getOptions: () => options1, resourcePath: 'some-path' } as LoaderContext;
    expect(cssLoader1.call(context1, 'ident-1')).toBe('custom-ident');

    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ enabled: false });
    const cssLoader2 = minifyCssIdents2.cssLoader;
    const options2: NodeJS.Dict<unknown> = { modules: { getLocalIdent: 'bad-value' } };
    const context2 = { getOptions: () => options2, resourcePath: 'some-path' } as LoaderContext;
    expect(cssLoader2.call(context2, 'ident-1')).toBe('___some-path__ident-1');
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
    const { thisCompilation } = minifyCssIdentsPlugin2.apply().hooks;
    thisCompilation.trigger();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const get = jest.fn(Object.getOwnPropertyDescriptor(MinifyCssIdentsPlugin.prototype, 'getLocalIdent')?.get);
    Object.defineProperty(minifyCssIdentsPlugin2, 'getLocalIdent', { get });
    const loaderContext = { ...thisCompilation.loaderContext, resourcePath: '' };
    expect(() => MinifyCssIdentsPlugin.getLocalIdent(loaderContext)).not.toThrow();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('Map is loaded', () => {
    fs.readFileSync.mockImplementation(() => '{}');

    const minifyCssIdents0 = new MinifyCssIdentsPlugin();
    minifyCssIdents0.apply().hooks.beforeCompile.trigger();
    expect(fs.readFileSync).toHaveBeenCalledTimes(0);

    const minifyCssIdents1 = new MinifyCssIdentsPlugin({ inputMap: 'some-relative-path' });
    minifyCssIdents1.apply().hooks.beforeCompile.trigger();
    expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync).toHaveBeenCalledWith(join(sep, 'default-context', 'some-relative-path'), 'utf-8');

    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ inputMap: join(sep, 'some-absolute-path') });
    minifyCssIdents2.apply().hooks.beforeCompile.trigger();
    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync).toHaveBeenCalledWith(join(sep, 'some-absolute-path'), 'utf-8');
  });

  it('Map is saved', () => {
    const rawSource = new sources.RawSource('{}\n');

    const minifyCssIdents0 = new MinifyCssIdentsPlugin();
    const compilation0 = minifyCssIdents0.apply().hooks.thisCompilation;
    compilation0.emitAsset.mockImplementation();
    compilation0.trigger();
    expect(compilation0.emitAsset).toHaveBeenCalledTimes(0);

    const minifyCssIdents1 = new MinifyCssIdentsPlugin({ outputMap: 'some-relative-path' });
    const compilation1 = minifyCssIdents1.apply().hooks.thisCompilation;
    compilation1.emitAsset.mockImplementation();
    compilation1.trigger();
    expect(compilation1.emitAsset).toHaveBeenCalledTimes(1);
    expect(compilation1.emitAsset).toHaveBeenCalledWith('some-relative-path', rawSource);

    const minifyCssIdents2 = new MinifyCssIdentsPlugin({ outputMap: join(sep, 'some-absolute-path') });
    const compilation2 = minifyCssIdents2.apply().hooks.thisCompilation;
    compilation2.emitAsset.mockImplementation();
    compilation2.trigger();
    expect(compilation2.emitAsset).toHaveBeenCalledTimes(1);
    expect(compilation2.emitAsset).toHaveBeenCalledWith(join('..', 'some-absolute-path'), rawSource);
  });
});
