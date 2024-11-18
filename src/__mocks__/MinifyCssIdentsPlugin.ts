// Meant to be imported, not called with jest.mock().
import type IdentGenerator from '../IdentGenerator';
import { Compiler, LoaderContext, WebpackOptionsNormalized } from 'webpack';
import EventEmitter from 'events';
import { join, sep } from 'path';
import OriginalMinifyCssIdentsPlugin from '../MinifyCssIdentsPlugin';

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

  public apply(compiler?: Compiler, loaderContext?: Partial<LoaderContext<object>>) {
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
    function getLocalIdent(context: LoaderContext<object>, localIdentName: string, localName: string): string;
    function getLocalIdent(
      arg0?: GetLocalIdentFn | string | LoaderContext<object>,
      localIdentName = '',
      localName = '',
    ) {
      if (arg0 === void 0 || typeof arg0 === 'function') {
        priorGetLocalIdent = arg0;
        return getLocalIdent;
      } else {
        const contextArg = typeof arg0 === 'object' ? arg0 : { resourcePath: arg0 };
        const loaderContext = minifyCssIdentsPlugin.compiler?.hooks.compilation.loaderContext;
        const context = { mode: 'production', ...loaderContext, ...contextArg } as LoaderContext<object>;
        return superGetLocalIdent(priorGetLocalIdent)(context, localIdentName, localName, {});
      }
    }
    return getLocalIdent;
  }

  public static get getLocalIdent() {
    const superGetLocalIdent = OriginalMinifyCssIdentsPlugin.getLocalIdent;
    let priorGetLocalIdent: GetLocalIdentFn | undefined = void 0;
    function getLocalIdent(priorGetLocalIdent?: GetLocalIdentFn): MockedGetLocalIdentFn;
    function getLocalIdent(resourcePath: string, localIdentName?: string, localName?: string): string;
    function getLocalIdent(context: LoaderContext<object>, localIdentName?: string, localName?: string): string;
    function getLocalIdent(
      this: unknown,
      arg0?: GetLocalIdentFn | string | LoaderContext<object>,
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
        const loaderContext = compiler?.hooks.compilation.loaderContext;
        const context = { mode: 'production', ...loaderContext, ...contextArg } as LoaderContext<object>;
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
  (context: LoaderContext<object>, localIdentName?: string, localName?: string): string;
}

function mockCompiler(
  webpackOptions?: Partial<WebpackOptionsNormalized>,
  loaderContext?: Partial<LoaderContext<object>>,
  compiler?: Compiler,
) {
  const beforeCompile = new FakeHook();
  const compilation = new CompilationHook({ mode: webpackOptions?.mode, ...loaderContext });
  const getCompilationHooks = (compilationArg = compilation) => compilationArg.moreHooks;
  const webpack = { ...compiler?.webpack, NormalModule: { getCompilationHooks } };
  const hooks = { ...compiler?.hooks, beforeCompile, compilation };
  const options = { mode: 'production', ...compiler?.options, ...webpackOptions };
  const fakeCompiler = { context: join(sep, 'default-context'), ...compiler, hooks, options, webpack };
  return fakeCompiler as Compiler & typeof fakeCompiler;
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

  public constructor(loaderContext?: Partial<LoaderContext<object>>) {
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
