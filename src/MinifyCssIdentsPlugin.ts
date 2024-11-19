import { rmSync } from 'fs';
import { isAbsolute, join, relative } from 'path';
import { Schema } from 'schema-utils/declarations/validate';
import { Compilation, Compiler, LoaderContext as LegacyLoaderContext, Module, sources } from 'webpack';
import { LoaderDefinition, LoaderDefinitionFunction, PitchLoaderDefinitionFunction } from 'webpack';
import { MinifyCssIdentsError } from './MinifyCssIdentsError';
import { escape, escapeLocalIdent, isDictLike } from './utils';
import legacyCssLoader, { defaultGetLocalIdent as legacyDefaultGetLocalIdent } from 'css-loader';
import IdentGeneratorImport from './IdentGenerator';

class MinifyCssIdentsPlugin extends Module {
  public readonly options: MinifyCssIdentsPlugin.Options.Resolved;
  protected readonly identGenerator: IdentGeneratorImport;
  protected applied = false;
  protected enabled: boolean | null;

  public constructor(options?: MinifyCssIdentsPlugin.Options | null) {
    super('css/minify-ident');
    this.identGenerator = new IdentGeneratorImport(options);
    this.options = Object.freeze({
      enabled: options?.enabled ?? null,
      filename: options?.filename ?? null,
      mode: options?.mode ?? 'default',
      ...this.identGenerator.options,
    });
    this.enabled = this.options.enabled;
    MinifyCssIdentsPlugin.implicitInstance = this;
  }

  public get cssLoader() {
    return MinifyCssIdentsPlugin.createCssLoader(this);
  }

  public get getLocalIdent() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const plugin = this;
    let priorGetLocalIdent = defaultGetLocalIdent;
    function getLocalIdent(this: unknown, ...args: [priorGetLocalIdent?: GetLocalIdentFn]): GetLocalIdentFn;
    function getLocalIdent(this: unknown, ...args: Parameters<GetLocalIdentFn>): string;
    function getLocalIdent(
      this: unknown,
      ...args: [priorGetLocalIdent?: GetLocalIdentFn] | Parameters<GetLocalIdentFn>
    ): GetLocalIdentFn | string {
      if (args[0] === void 0 || typeof args[0] === 'function') {
        priorGetLocalIdent = args[0] ?? priorGetLocalIdent;
        return getLocalIdent;
      } else {
        const [context, ...otherArgs] = args as Parameters<GetLocalIdentFn>;
        plugin.enabled ??= context.mode === 'production';
        const priorLocalIdent = priorGetLocalIdent.call(this, context, ...otherArgs);
        return plugin.enabled ? plugin.identGenerator.generateIdent(priorLocalIdent) : priorLocalIdent;
      }
    }
    return getLocalIdent;
  }

  public apply(compiler: Compiler) {
    if (!this.applied) {
      const { name } = MinifyCssIdentsPlugin;
      const { enabled, filename, mode } = this.options;
      this.enabled = enabled ?? compiler.options.mode === 'production';
      const resolvedFilename = filename && (isAbsolute(filename) ? filename : join(compiler.context, filename));
      if (this.enabled && resolvedFilename) {
        if (mode === 'default' || mode === 'load-map' || mode === 'extend-map' || mode === 'consume-map') {
          compiler.hooks.beforeCompile.tap(name, () =>
            this.identGenerator.loadMap(resolvedFilename, mode === 'default'),
          );
        }
      }
      compiler.hooks.compilation.tap(name, (compilation) => {
        compiler.webpack.NormalModule.getCompilationHooks(compilation).loader.tap(name, (context) => {
          (context as MinifyCssIdentsPlugin.LoaderContext)[MinifyCssIdentsPlugin.symbol] = this;
        });
        if (this.enabled && resolvedFilename && mode !== 'load-map') {
          const stage = Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE;
          compilation.hooks.afterProcessAssets.tap({ stage, name }, () => {
            if (mode === 'consume-map') {
              removeMap(resolvedFilename);
            } else {
              const relativeFilename = relative(compiler.context, resolvedFilename);
              compilation.emitAsset(relativeFilename, new sources.RawSource(this.identGenerator.stringifyMap()));
            }
          });
        }
      });
      this.applied = true;
    }
  }

  public static readonly Error = MinifyCssIdentsError;

  public static readonly IdentGenerator = IdentGeneratorImport;

  protected static implicitInstance?: MinifyCssIdentsPlugin;

  public static readonly symbol = Symbol(MinifyCssIdentsPlugin.name);

  public static readonly defaultGetLocalIdent = defaultGetLocalIdent;

  protected static createCssLoader(plugin?: MinifyCssIdentsPlugin): LoaderDefinition {
    let minifyCssIdentsPlugin = plugin;
    function pitch(this: MinifyCssIdentsPlugin.LoaderContext, ...args: Parameters<PitchLoaderDefinitionFunction>) {
      const getOptions = this.getOptions;
      if (!getOptions[MinifyCssIdentsPlugin.symbol]) {
        this.getOptions = function MinifyCssIdentsPlugin_getOptions(schema: Schema = {}) {
          const options = getOptions.call(this, schema);
          if (!options[MinifyCssIdentsPlugin.symbol]) {
            options[MinifyCssIdentsPlugin.symbol] = true;
            options.modules ??= {};
            if (isDictLike(options.modules)) {
              const { getLocalIdent } = options.modules;
              minifyCssIdentsPlugin ??= MinifyCssIdentsPlugin.getInstance(this);
              options.modules.getLocalIdent = MinifyCssIdentsPlugin.getLocalIdent(
                getLocalIdent instanceof Function ? (getLocalIdent as GetLocalIdentFn) : void 0,
              );
            }
          }
          return options;
        };
        this.getOptions[MinifyCssIdentsPlugin.symbol] = true;
      }
      return legacyCssLoader.pitch?.apply(this, args);
    }
    function cssLoader(this: MinifyCssIdentsPlugin.LoaderContext, ...args: Parameters<LoaderDefinitionFunction>) {
      return legacyCssLoader.apply(this, args);
    }
    return Object.assign(cssLoader, { ...legacyCssLoader, pitch });
  }

  public static get cssLoader() {
    return MinifyCssIdentsPlugin.createCssLoader();
  }

  protected static getInstance(context: MinifyCssIdentsPlugin.LoaderContext) {
    return context[this.symbol] ?? this.implicitInstance ?? new this();
  }

  public static get getLocalIdent() {
    let minifyCssIdentsPlugin: MinifyCssIdentsPlugin;
    let priorGetLocalIdent = defaultGetLocalIdent;
    function getLocalIdent(this: unknown, ...args: [priorGetLocalIdent?: GetLocalIdentFn]): GetLocalIdentFn;
    function getLocalIdent(this: unknown, ...args: Parameters<GetLocalIdentFn>): string;
    function getLocalIdent(
      this: unknown,
      ...args: [priorGetLocalIdent?: GetLocalIdentFn] | Parameters<GetLocalIdentFn>
    ): GetLocalIdentFn | string {
      if (args[0] === void 0 || typeof args[0] === 'function') {
        priorGetLocalIdent = args[0] ?? priorGetLocalIdent;
        return getLocalIdent;
      } else {
        const [context, ...otherArgs] = args as Parameters<GetLocalIdentFn>;
        minifyCssIdentsPlugin ??= MinifyCssIdentsPlugin.getInstance(context);
        return minifyCssIdentsPlugin.getLocalIdent(priorGetLocalIdent).call(this, context, ...otherArgs);
      }
    }
    return getLocalIdent;
  }
}

function defaultGetLocalIdent(this: unknown, ...args: Parameters<GetLocalIdentFn>) {
  const [, , localName] = args;
  const defaultLocalIdent = legacyDefaultGetLocalIdent.apply(this, args);
  // For some reason, defaultGetLocalIdent does not get all the job done
  // and does not replace [local] in the ident template nor escape the resulting ident.
  const resolvedLocalIdent = defaultLocalIdent.replace(/\[local]/gi, escape(localName));
  return escapeLocalIdent(resolvedLocalIdent);
}

function removeMap(filename: string) {
  try {
    rmSync(filename);
  } catch (cause) {
    // eslint-disable-next-line no-console
    console.warn(MinifyCssIdentsError.message(`Failure to remove CSS identifier map file ${filename}`, cause));
  }
}

namespace MinifyCssIdentsPlugin {
  export type Error = MinifyCssIdentsError;

  export interface GetLocalIdentFn {
    (this: unknown, context: LoaderContext, localIdentName: string, localName: string, options: object): string;
  }

  export namespace GetLocalIdentFn {
    export interface Extended extends GetLocalIdentFn {
      (priorGetLocalIdent?: GetLocalIdentFn): GetLocalIdentFn;
    }
  }

  export type IdentGenerator = IdentGeneratorImport;

  export namespace IdentGenerator {
    export type Error = IdentGeneratorImport.Error;

    export type Map = IdentGeneratorImport.Map;

    export type Options = IdentGeneratorImport.Options;

    export namespace Options {
      export type Resolved = IdentGeneratorImport.Options.Resolved;
    }
  }

  export interface LoaderContext extends LegacyLoaderContext<{ [key in string | symbol]?: unknown }> {
    [MinifyCssIdentsPlugin.symbol]?: MinifyCssIdentsPlugin;
    getOptions: LegacyLoaderContext<{ [key in string | symbol]?: unknown }>['getOptions'] & {
      [MinifyCssIdentsPlugin.symbol]?: true;
    };
  }

  export interface Options extends IdentGenerator.Options {
    enabled?: boolean | null;
    filename?: string | null;
    mode?: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map' | null;
  }

  export namespace Options {
    export interface Resolved extends IdentGenerator.Options.Resolved {
      enabled: boolean | null;
      filename: string | null;
      mode: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map';
    }
  }
}

type GetLocalIdentFn = MinifyCssIdentsPlugin.GetLocalIdentFn;

namespace GetLocalIdentFn {
  export type Extended = MinifyCssIdentsPlugin.GetLocalIdentFn.Extended;
}

export = MinifyCssIdentsPlugin;
