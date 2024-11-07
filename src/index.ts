import { readFileSync, rmSync } from 'fs';
import { isAbsolute, relative } from 'path';
import { Compilation, Compiler, LoaderContext, Module, sources } from 'webpack';
import { IdentManager } from './IdentManager';
import { MinifyCssIdentsPluginError } from './Error';
import { escape, escapeLocalIdent, isError } from './utils';
import { defaultGetLocalIdent } from 'css-loader';

class MinifyCssIdentsPlugin extends Module {
  public readonly options: MinifyCssIdentsPlugin.Options.Resolved;
  protected readonly identManager: IdentManager;
  protected applied = false;

  public constructor(options?: MinifyCssIdentsPlugin.Options) {
    super('css/minify-ident');
    this.identManager = new IdentManager(options);
    this.options = Object.freeze({
      filename: options?.filename ?? null,
      mapIndent: options?.mapIndent ?? 2,
      mode: options?.mode ?? 'default',
      ...this.identManager.options,
    });
  }

  public get getLocalIdent() {
    const { identManager } = this;
    function getLocalIdent(
      this: unknown,
      context: LoaderContext<object>,
      localIdentName: string,
      localName: string,
      options: object,
    ): string;
    function getLocalIdent(this: unknown, ...args: Parameters<typeof defaultGetLocalIdent>) {
      // For some reason, defaultGetLocalIdent does not get all the job done
      // and does not replace [local] in the ident template nor escape the resulting ident.
      const defaultLocalIdent = defaultGetLocalIdent.apply(this, args).replace(/\[local]/gi, escape(args[2]));
      return identManager.generateIdent(escapeLocalIdent(defaultLocalIdent));
    }
    return getLocalIdent;
  }

  public apply(compiler: Compiler) {
    if (!this.applied) {
      const { filename, mode } = this.options;
      if (filename) {
        if (mode === 'default' || mode === 'load-map' || mode === 'extend-map' || mode === 'consume-map') {
          compiler.hooks.beforeCompile.tap(MinifyCssIdentsPlugin.name, () =>
            this.loadMap(filename, mode === 'default'),
          );
        }
        if (mode !== 'load-map') {
          const { name } = MinifyCssIdentsPlugin;
          compiler.hooks.compilation.tap(name, (compilation) => {
            const stage = Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE;
            compilation.hooks.afterProcessAssets.tap({ stage, name }, () => {
              if (mode === 'consume-map') {
                removeMap(filename);
              } else {
                const path = isAbsolute(filename) ? relative(compiler.context, filename) : filename;
                compilation.emitAsset(path, new sources.RawSource(this.stringifyMap()));
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
    filename?: string | null;
    mapIndent?: number | null;
    mode?: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map' | null;
  }

  export namespace Options {
    export interface Resolved extends IdentManager.Options.Resolved {
      filename: string | null;
      mapIndent: number;
      mode: 'default' | 'load-map' | 'extend-map' | 'consume-map' | 'create-map';
    }
  }
}

export = MinifyCssIdentsPlugin;
