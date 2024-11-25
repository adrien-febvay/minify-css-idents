import type { Schema } from 'schema-utils/declarations/validate';
import type { Compiler, LoaderContext as LegacyContext, LoaderDefinition, LoaderDefinitionFunction } from 'webpack';

import legacyCssLoader, { defaultGetLocalIdent as legacyDefaultGetLocalIdent } from 'css-loader';
import { isAbsolute, join, relative } from 'path';
import { Compilation, Module, sources } from 'webpack';
import { MinifyCssIdentsError } from './MinifyCssIdentsError';
import { Falsy, escape, escapeLocalIdent, isDictLike } from './utils';
import IdentGeneratorImport from './IdentGenerator';

class MinifyCssIdentsPlugin extends Module {
  public readonly options: MinifyCssIdentsPlugin.Options.Sanitized;
  protected readonly identGenerator: IdentGeneratorImport;
  protected applied = false;
  protected enabled: boolean | null;

  public constructor(options?: MinifyCssIdentsPlugin.Options | null) {
    super('css/minify-ident');
    this.identGenerator = new IdentGeneratorImport(options);
    this.options = Object.freeze({
      enabled: options?.enabled == null ? null : Boolean(options.enabled),
      inputMap: options?.inputMap || null,
      outputMap: options?.outputMap || null,
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
        plugin.enabled ??= context._compiler?.options.optimization.minimize ?? context.mode === 'production';
        const priorLocalIdent = priorGetLocalIdent.call(this, context, ...otherArgs);
        return plugin.enabled ? plugin.identGenerator.generateIdent(priorLocalIdent) : priorLocalIdent;
      }
    }
    return getLocalIdent;
  }

  public apply(compiler: Compiler) {
    if (!this.applied) {
      const { name } = MinifyCssIdentsPlugin;
      const { outputMap, enabled, inputMap } = this.options;
      this.enabled = enabled ?? compiler.options.optimization.minimize ?? compiler.options.mode === 'production';
      if (this.enabled && inputMap) {
        const resolvedSourceMap = isAbsolute(inputMap) ? inputMap : join(compiler.context, inputMap);
        compiler.hooks.beforeCompile.tap(name, () => this.identGenerator.loadMap(resolvedSourceMap));
      }
      compiler.hooks.compilation.tap(name, (compilation) => {
        compiler.webpack.NormalModule.getCompilationHooks(compilation).loader.tap(name, (context) => {
          (context as MinifyCssIdentsPlugin.LoaderContext)[MinifyCssIdentsPlugin.symbol] = this;
        });
        if (this.enabled && outputMap) {
          const stage = Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE;
          compilation.hooks.afterProcessAssets.tap({ stage, name }, () => {
            const relativeEmitMap = isAbsolute(outputMap) ? relative(compiler.outputPath, outputMap) : outputMap;
            compilation.emitAsset(relativeEmitMap, new sources.RawSource(this.identGenerator.stringifyMap()));
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
    let options: NodeJS.Dict<unknown>;
    function cssLoader(this: MinifyCssIdentsPlugin.LoaderContext, ...args: Parameters<LoaderDefinitionFunction>) {
      const legacyGetOptions = this.getOptions.bind(this);
      function getOptions(this: MinifyCssIdentsPlugin.LoaderContext, schema: Schema = {}) {
        if (!options) {
          options = legacyGetOptions(schema);
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
      }
      return legacyCssLoader.apply({ ...this, getOptions }, args);
    }
    return Object.assign(cssLoader, { ...legacyCssLoader });
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
      export type Sanitized = IdentGeneratorImport.Options.Sanitized;
    }
  }

  export interface LoaderContext extends LegacyContext<NodeJS.Dict<unknown>> {
    [MinifyCssIdentsPlugin.symbol]?: MinifyCssIdentsPlugin;
  }

  export interface Options extends IdentGenerator.Options {
    enabled?: Falsy<boolean>;
    inputMap?: Falsy<string>;
    outputMap?: Falsy<string>;
  }

  export namespace Options {
    export interface Sanitized extends IdentGenerator.Options.Sanitized {
      enabled: boolean | null;
      inputMap: string | null;
      outputMap: string | null;
    }
  }
}

type GetLocalIdentFn = MinifyCssIdentsPlugin.GetLocalIdentFn;

namespace GetLocalIdentFn {
  export type Extended = MinifyCssIdentsPlugin.GetLocalIdentFn.Extended;
}

export = MinifyCssIdentsPlugin;
