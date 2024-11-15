// Meant to be imported, not called with jest.mock().
import type IdentGenerator from '../IdentGenerator';
import { Compiler, LoaderContext, WebpackOptionsNormalized } from 'webpack';
import EventEmitter from 'events';
import { join, sep } from 'path';
import OriginalMinifiyCssIdentsPlugin from '../MinifiyCssIdentsPlugin';

export class MinifiyCssIdentsPlugin extends OriginalMinifiyCssIdentsPlugin {
  public declare enabled: boolean;
  public declare identGenerator: IdentGenerator;
  public declare getLocalIdentCache?: OriginalMinifiyCssIdentsPlugin.GetLocalIdentFn;
  public webpackOptions?: Partial<WebpackOptionsNormalized>;

  public constructor(
    options?: OriginalMinifiyCssIdentsPlugin.Options | null,
    webpackOptions?: Partial<WebpackOptionsNormalized>,
  ) {
    super(options);
    this.webpackOptions = webpackOptions;
  }

  public apply(compiler?: Compiler) {
    const resolvedCompiler = mockCompiler(this.webpackOptions, compiler);
    super.apply(resolvedCompiler);
    return resolvedCompiler;
  }

  public get getLocalIdent() {
    const superGetLocalIdent = super.getLocalIdent;
    function getLocalIdent(resourcePath?: string, localIdentName?: string, localName?: string): string;
    function getLocalIdent(context: LoaderContext<object>, localIdentName: string, localName: string): string;
    function getLocalIdent(arg0: string | LoaderContext<object> = '', localIdentName = '', localName = '') {
      const contextArg = typeof arg0 === 'object' ? arg0 : { resourcePath: arg0 };
      const context = { mode: 'production', ...contextArg } as LoaderContext<object>;
      return superGetLocalIdent(context, localIdentName, localName, {});
    }
    return getLocalIdent;
  }

  public static get getLocalIdent() {
    const superGetLocalIdent = OriginalMinifiyCssIdentsPlugin.getLocalIdent;
    function getLocalIdent(resourcePath?: string, localIdentName?: string, localName?: string): string;
    function getLocalIdent(context: LoaderContext<object>, localIdentName: string, localName: string): string;
    function getLocalIdent(
      this: unknown,
      arg0: string | LoaderContext<object> = '',
      localIdentName = '',
      localName = '',
    ) {
      const contextArg = typeof arg0 === 'object' ? arg0 : { resourcePath: arg0 };
      const context = { mode: 'production', ...contextArg } as LoaderContext<object>;
      return superGetLocalIdent.call(this, context, localIdentName, localName, {});
    }
    return getLocalIdent;
  }

  public static get implicitInstance() {
    return OriginalMinifiyCssIdentsPlugin.implicitInstance;
  }

  public static set implicitInstance(minifiyCssIdentsPlugin: OriginalMinifiyCssIdentsPlugin | undefined) {
    OriginalMinifiyCssIdentsPlugin.implicitInstance = minifiyCssIdentsPlugin;
  }
}

function mockCompiler(webpackOptions: Partial<WebpackOptionsNormalized> = {}, compiler?: Compiler) {
  const beforeCompile = new FakeHook();
  const compilation = new CompilationHook();
  const hooks = { ...compiler?.hooks, beforeCompile, compilation };
  const options = { mode: 'production', ...compiler?.options, ...webpackOptions };
  const fakeCompiler = { context: join(sep, 'default-context'), ...compiler, hooks, options };
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
