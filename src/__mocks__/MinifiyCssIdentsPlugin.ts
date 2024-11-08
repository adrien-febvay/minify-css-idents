// Meant to be imported, not called with jest.mock().
import { Compiler, LoaderContext, WebpackOptionsNormalized } from 'webpack';
import EventEmitter from 'events';
import OriginalMinifiyCssIdentsPlugin from '../MinifiyCssIdentsPlugin';
import { IdentManager } from '../IdentManager';

export class MinifiyCssIdentsPlugin extends OriginalMinifiyCssIdentsPlugin {
  public declare enabled: boolean;
  public declare identManager: IdentManager;
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
    function getLocalIdent(resourcePath: string, localIdentName: string, localName: string): string;
    function getLocalIdent(context: LoaderContext<object>, localIdentName: string, localName: string): string;
    function getLocalIdent(arg0: string | LoaderContext<object>, localIdentName: string, localName: string) {
      const context = typeof arg0 === 'object' ? arg0 : ({ resourcePath: arg0 } as LoaderContext<object>);
      return superGetLocalIdent(context, localIdentName, localName, {});
    }
    return getLocalIdent;
  }
}

function mockCompiler(webpackOptions: Partial<WebpackOptionsNormalized> = {}, compiler?: Compiler) {
  const beforeCompile = new FakeHook();
  const compilation = new CompilationHook();
  const hooks = { ...compiler?.hooks, beforeCompile, compilation };
  const options = { ...compiler?.options, ...webpackOptions, mode: webpackOptions.mode ?? 'production' };
  const fakeCompiler = { context: '/default-context', ...compiler, hooks, options };
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