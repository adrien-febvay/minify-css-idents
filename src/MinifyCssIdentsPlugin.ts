import { readFileSync, rmSync } from 'fs';
import { isAbsolute, join, relative } from 'path';
import { Compilation, Compiler, LoaderContext, Module, sources } from 'webpack';
import { IdentManager } from './IdentManager';
import { MinifyCssIdentsPluginError } from './Error';
import { escape, escapeLocalIdent, isError } from './utils';
import { defaultGetLocalIdent } from 'css-loader';

class MinifyCssIdentsPlugin extends Module {
  public readonly options: MinifyCssIdentsPlugin.Options.Resolved;
  protected readonly identManager: IdentManager;
  protected applied = false;
  protected enabled: boolean | null;
  protected getLocalIdentCache?: (typeof MinifyCssIdentsPlugin)['getLocalIdent'];

  public constructor(options?: MinifyCssIdentsPlugin.Options | null) {
    super('css/minify-ident');
    MinifyCssIdentsPlugin.implicitInstance = this;
    this.identManager = new IdentManager(options);
    this.options = Object.freeze({
      enabled: options?.enabled ?? null,
      filename: options?.filename ?? null,
      mapIndent: options?.mapIndent ?? 2,
      mode: options?.mode ?? 'default',
      ...this.identManager.options,
    });
    this.enabled = this.options.enabled;
  }

  public get getLocalIdent() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const plugin = this;
    function getLocalIdent(
      this: unknown,
      context: LoaderContext<object>,
      localIdentName: string,
      localName: string,
      options: object,
    ): string;
    function getLocalIdent(this: unknown, ...args: Parameters<typeof defaultGetLocalIdent>) {
      plugin.enabled ??= args[0].mode === 'production';
      // For some reason, defaultGetLocalIdent does not get all the job done
      // and does not replace [local] in the ident template nor escape the resulting ident.
      const defaultLocalIdent = defaultGetLocalIdent.apply(this, args).replace(/\[local]/gi, escape(args[2]));
      const escapedLocalIdent = escapeLocalIdent(defaultLocalIdent);
      return plugin.enabled ? plugin.identManager.generateIdent(escapedLocalIdent) : escapedLocalIdent;
    }
    this.getLocalIdentCache ??= getLocalIdent;
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
            this.loadMap(resolvedFilename, mode === 'default'),
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
                compilation.emitAsset(relativeFilename, new sources.RawSource(this.stringifyMap()));
              }
            });
          });
        }
      }
      this.applied = true;
    }
  }

  protected loadMap(filename: string, ignoreNoEnt?: boolean) {
    const mapBytes = readMap(filename, ignoreNoEnt);
    if (mapBytes !== null) {
      this.identManager.loadMap(parseMap(filename, mapBytes), filename);
    }
  }

  protected stringifyMap() {
    return `${JSON.stringify(this.identManager.identMap, null, this.options.mapIndent)}\n`;
  }

  public static readonly alphabet = IdentManager.alphabet;

  public static readonly Error = MinifyCssIdentsPluginError;

  public static getLocalIdent(
    this: unknown,
    context: LoaderContext<object>,
    localIdentName: string,
    localName: string,
    options: object,
  ): string;

  public static getLocalIdent(this: unknown, ...args: Parameters<typeof defaultGetLocalIdent>) {
    MinifyCssIdentsPlugin.implicitInstance ??= new MinifyCssIdentsPlugin();
    return MinifyCssIdentsPlugin.implicitInstance.getLocalIdent.apply(this, args);
  }

  protected static implicitInstance?: MinifyCssIdentsPlugin;
}

function parseMap(filename: string, bytes: string) {
  try {
    return JSON.parse(bytes);
  } catch (cause) {
    throw new MinifyCssIdentsPluginError(`Failure to parse ${filename}`, cause, parseMap);
  }
}

function readMap(filename: string, ignoreNoEnt?: boolean) {
  try {
    return readFileSync(filename, 'utf-8');
  } catch (cause) {
    if (ignoreNoEnt && isError(cause) && cause.code === 'ENOENT') {
      return null;
    } else {
      throw new MinifyCssIdentsPluginError(`Failure to read ${filename}`, cause, parseMap);
    }
  }
}

function removeMap(filename: string) {
  try {
    rmSync(filename);
  } catch (cause) {
    // eslint-disable-next-line no-console
    console.warn(MinifyCssIdentsPluginError.message(`Failure to remove CSS identifier map file ${filename}`, cause));
  }
}

namespace MinifyCssIdentsPlugin {
  export type Error = MinifyCssIdentsPluginError;

  export type Map = IdentManager.Map;

  export interface Options extends IdentManager.Options {
    enabled?: boolean | null;
    filename?: string | null;
    mapIndent?: number | null;
    mode?: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map' | null;
  }

  export namespace Options {
    export interface Resolved extends IdentManager.Options.Resolved {
      enabled: boolean | null;
      filename: string | null;
      mapIndent: number;
      mode: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map';
    }
  }
}

export = MinifyCssIdentsPlugin;
