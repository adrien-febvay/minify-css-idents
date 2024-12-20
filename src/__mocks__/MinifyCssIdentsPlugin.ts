// Meant to be imported, not called with jest.mock().
import type IdentGenerator from '../IdentGenerator';
import { Compiler, WebpackOptionsNormalized } from 'webpack';
import EventEmitter from 'events';
import { join, sep } from 'path';
import OriginalMinifyCssIdentsPlugin from '../MinifyCssIdentsPlugin';

export type LoaderContext = OriginalMinifyCssIdentsPlugin.LoaderContext;

export class MinifyCssIdentsPlugin extends OriginalMinifyCssIdentsPlugin {
  public declare enabled: boolean;
  public declare identGenerator: IdentGenerator;
  public declare getLocalIdentCache?: OriginalMinifyCssIdentsPlugin.GetLocalIdentFn;
  public compiler?: ReturnType<typeof mockCompiler>;
  public webpackOptions?: Partial<WebpackOptionsNormalized>;

  public constructor(
    options?: OriginalMinifyCssIdentsPlugin.Options | null,
    webpackOptions?: Partial<WebpackOptionsNormalized>,
  ) {
    super(options);
    this.webpackOptions = webpackOptions;
  }

  public apply(compiler?: Compiler, loaderContext?: Partial<LoaderContext>) {
    this.compiler = mockCompiler(this.webpackOptions, loaderContext, compiler);
    super.apply(this.compiler);
    return this.compiler;
  }

  public get getLocalIdent() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const minifyCssIdentsPlugin = this;
    const superGetLocalIdent = super.getLocalIdent;
    let priorGetLocalIdent: GetLocalIdentFn | undefined = void 0;
    function getLocalIdent(priorGetLocalIdent?: GetLocalIdentFn): MockedGetLocalIdentFn;
    function getLocalIdent(resourcePath?: string, localIdentName?: string, localName?: string): string;
    function getLocalIdent(context: LoaderContext, localIdentName: string, localName: string): string;
    function getLocalIdent(arg0?: GetLocalIdentFn | string | LoaderContext, localIdentName = '', localName = '') {
      if (arg0 === void 0 || typeof arg0 === 'function') {
        priorGetLocalIdent = arg0;
        return getLocalIdent;
      } else {
        const contextArg = typeof arg0 === 'object' ? arg0 : { resourcePath: arg0 };
        const loaderContext = minifyCssIdentsPlugin.compiler?.hooks.thisCompilation.loaderContext;
        const context = { mode: 'production', ...loaderContext, ...contextArg } as LoaderContext;
        return superGetLocalIdent(priorGetLocalIdent)(context, localIdentName, localName, {});
      }
    }
    return getLocalIdent;
  }

  public static get cssLoader() {
    return OriginalMinifyCssIdentsPlugin.cssLoader;
  }

  public static get getLocalIdent() {
    const superGetLocalIdent = OriginalMinifyCssIdentsPlugin.getLocalIdent;
    let priorGetLocalIdent: GetLocalIdentFn | undefined = void 0;
    function getLocalIdent(priorGetLocalIdent?: GetLocalIdentFn): MockedGetLocalIdentFn;
    function getLocalIdent(resourcePath: string, localIdentName?: string, localName?: string): string;
    function getLocalIdent(context: LoaderContext, localIdentName?: string, localName?: string): string;
    function getLocalIdent(
      this: unknown,
      arg0?: GetLocalIdentFn | string | LoaderContext,
      localIdentName = '',
      localName = '',
    ) {
      if (arg0 === void 0 || typeof arg0 === 'function') {
        priorGetLocalIdent = arg0;
        return getLocalIdent;
      } else {
        const contextArg = typeof arg0 === 'object' ? arg0 : { resourcePath: arg0 };
        const instance = MinifyCssIdentsPlugin.implicitInstance;
        const compiler = instance instanceof MinifyCssIdentsPlugin ? instance.compiler : null;
        const loaderContext = compiler?.hooks.thisCompilation.loaderContext;
        const context = { mode: 'production', ...loaderContext, ...contextArg } as LoaderContext;
        return superGetLocalIdent(priorGetLocalIdent).call(this, context, localIdentName, localName, {});
      }
    }
    return getLocalIdent;
  }

  public static get implicitInstance() {
    return OriginalMinifyCssIdentsPlugin.implicitInstance;
  }

  public static set implicitInstance(minifyCssIdentsPlugin: OriginalMinifyCssIdentsPlugin | undefined) {
    OriginalMinifyCssIdentsPlugin.implicitInstance = minifyCssIdentsPlugin;
  }

  public static readonly symbol: typeof OriginalMinifyCssIdentsPlugin.symbol = OriginalMinifyCssIdentsPlugin.symbol;
}

type GetLocalIdentFn = OriginalMinifyCssIdentsPlugin.GetLocalIdentFn;

interface MockedGetLocalIdentFn {
  (priorGetLocalIdent?: GetLocalIdentFn): MockedGetLocalIdentFn;
  (resourcePath?: string, localIdentName?: string, localName?: string): string;
  (context: LoaderContext, localIdentName?: string, localName?: string): string;
}

function mockCompiler(
  webpackOptions?: Partial<WebpackOptionsNormalized>,
  loaderContext?: Partial<LoaderContext>,
  compiler = {} as Compiler,
): Compiler & { hooks: ReturnType<typeof mockHooks> } {
  const hooks = { ...compiler?.hooks, ...mockHooks(webpackOptions, loaderContext) };
  const getCompilationHooks = (compilationArg = hooks.thisCompilation) => compilationArg.moreHooks;
  const context = compiler?.context ?? join(sep, 'default-context');
  const optimization = compiler?.options?.optimization ?? webpackOptions?.optimization ?? { minimize: true };
  const options = { mode: 'production', ...compiler?.options, ...webpackOptions, optimization };
  const outputPath = compiler?.outputPath ?? join(sep, 'default-output');
  const webpack = { ...compiler?.webpack, NormalModule: { getCompilationHooks } };
  const fakeCompiler = { ...compiler, context, hooks, options, outputPath, webpack };
  hooks.thisCompilation.loaderContext._compiler = fakeCompiler as Compiler & typeof fakeCompiler;
  return fakeCompiler as Compiler & typeof fakeCompiler;
}

function mockHooks(webpackOptions?: Partial<WebpackOptionsNormalized>, loaderContext?: Partial<LoaderContext>) {
  const beforeCompile = new FakeHook();
  const thisCompilation = new CompilationHook({ mode: webpackOptions?.mode, ...loaderContext });
  return { beforeCompile, thisCompilation };
}

class FakeHook<TapType = string, Args extends unknown[] = []> {
  public emitter = new EventEmitter();
  public listeners: ((args: Args) => void)[] = [];
  public triggerCount = 0;

  public get listener() {
    return this.listeners[0];
  }

  public tap(_type: TapType, callback: (...args: Args) => void) {
    const listener = jest.fn((args: Args) => callback.call(null, ...args));
    this.listeners.push(listener);
    this.emitter.on('emit', listener);
  }

  public trigger(...args: Args) {
    this.triggerCount += 1;
    return this.emitter.emit('emit', args);
  }
}

class CompilationHook extends FakeHook<string, [CompilationHook]> {
  public readonly hooks = { afterProcessAssets: new FakeHook<{ stage: number; name: string }>() };
  public readonly moreHooks = { loader: new FakeHook<string, [OriginalMinifyCssIdentsPlugin.LoaderContext]>() };
  public readonly loaderContext: OriginalMinifyCssIdentsPlugin.LoaderContext;

  public constructor(loaderContext?: Partial<LoaderContext>) {
    super();
    this.loaderContext = loaderContext as OriginalMinifyCssIdentsPlugin.LoaderContext;
  }

  public emitAsset = jest.fn();

  public trigger() {
    super.trigger(this);
    this.moreHooks.loader.trigger(this.loaderContext);
    return this.hooks.afterProcessAssets.trigger();
  }
}
