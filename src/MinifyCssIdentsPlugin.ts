import { rmSync } from 'fs';
import { isAbsolute, join, relative } from 'path';
import { Compilation, Compiler, LoaderContext, Module, sources } from 'webpack';
import { MinifyCssIdentsError } from './MinifyCssIdentsError';
import { escape, escapeLocalIdent } from './utils';
import { defaultGetLocalIdent } from 'css-loader';
import IdentGeneratorImport from './IdentGenerator';

class MinifyCssIdentsPlugin extends Module {
  public readonly options: MinifyCssIdentsPlugin.Options.Resolved;
  protected readonly identGenerator: IdentGeneratorImport;
  protected applied = false;
  protected enabled: boolean | null;
  protected getLocalIdentCache?: MinifyCssIdentsPlugin.GetLocalIdentFn;

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

  public get getLocalIdent() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const plugin = this;
    this.getLocalIdentCache ??= function getLocalIdent(...args) {
      const [context, , localName] = args;
      plugin.enabled ??= context.mode === 'production';
      const defaultLocalIdent = defaultGetLocalIdent.apply(this, args);
      // For some reason, defaultGetLocalIdent does not get all the job done
      // and does not replace [local] in the ident template nor escape the resulting ident.
      const resolvedLocalIdent = defaultLocalIdent.replace(/\[local]/gi, escape(localName));
      const escapedLocalIdent = escapeLocalIdent(resolvedLocalIdent);
      return plugin.enabled ? plugin.identGenerator.generateIdent(escapedLocalIdent) : escapedLocalIdent;
    };
    return this.getLocalIdentCache;
  }

  public apply(compiler: Compiler) {
    if (!this.applied) {
      const { enabled, filename, mode } = this.options;
      this.enabled = enabled ?? compiler.options.mode === 'production';
      if (this.enabled && filename) {
        const resolvedFilename = isAbsolute(filename) ? filename : join(compiler.context, filename);
        if (mode === 'default' || mode === 'load-map' || mode === 'extend-map' || mode === 'consume-map') {
          compiler.hooks.beforeCompile.tap(MinifyCssIdentsPlugin.name, () =>
            this.identGenerator.loadMap(resolvedFilename, mode === 'default'),
          );
        }
        if (mode !== 'load-map') {
          const { name } = MinifyCssIdentsPlugin;
          compiler.hooks.compilation.tap(name, (compilation) => {
            const stage = Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE;
            compilation.hooks.afterProcessAssets.tap({ stage, name }, () => {
              if (mode === 'consume-map') {
                removeMap(resolvedFilename);
              } else {
                const relativeFilename = relative(compiler.context, resolvedFilename);
                compilation.emitAsset(relativeFilename, new sources.RawSource(this.identGenerator.stringifyMap()));
              }
            });
          });
        }
      }
      this.applied = true;
    }
  }

  public static readonly Error = MinifyCssIdentsError;

  public static readonly IdentGenerator = IdentGeneratorImport;

  protected static implicitInstance?: MinifyCssIdentsPlugin;

  public static get getLocalIdent() {
    function getLocalIdent(this: unknown, ...args: Parameters<MinifyCssIdentsPlugin.GetLocalIdentFn>) {
      MinifyCssIdentsPlugin.implicitInstance ??= new MinifyCssIdentsPlugin();
      return MinifyCssIdentsPlugin.implicitInstance.getLocalIdent.apply(this, args);
    }
    return MinifyCssIdentsPlugin.implicitInstance?.getLocalIdent ?? getLocalIdent;
  }
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

  export type GetLocalIdentFn = (
    this: unknown,
    context: LoaderContext<object>,
    localIdentName: string,
    localName: string,
    options: object,
  ) => string;

  export type IdentGenerator = IdentGeneratorImport;

  export namespace IdentGenerator {
    export type Error = IdentGeneratorImport.Error;

    export type Map = IdentGeneratorImport.Map;

    export type Options = IdentGeneratorImport.Options;

    export namespace Options {
      export type Resolved = IdentGeneratorImport.Options.Resolved;
    }
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

export = MinifyCssIdentsPlugin;
